# ============================================================================
# SEED HELPERS: parsing do muscle_usage_map.md e IDs determinísticos
# ============================================================================
"""
Porta exata das regras de `GymNight-Desktop/src/database/parser.py` para o
catálogo de exercícios compartilhado (PARIDADE-01-DESTRAVAR.md §3.4/3.5).

Usado pela migration 008 (seed do catálogo, nomes apenas) e reaproveitado
pela Wave 6 (percentuais de ativação muscular + valores MET) — ambas
precisam gerar o MESMO id determinístico para o mesmo exercício, então a
normalização e o namespace de UUID vivem aqui, num lugar só.
"""
import re
import unicodedata
import uuid
from pathlib import Path

from .seed_data.met_values import EXERCISE_MET_MAP

SEED_DATA_DIR = Path(__file__).resolve().parent / "seed_data"
MUSCLE_USAGE_MAP_PATH = SEED_DATA_DIR / "muscle_usage_map.md"

# Namespace fixo para os UUIDv5 do catálogo de exercícios. `uuid5` é
# determinístico: mesmo namespace + mesmo nome normalizado sempre produz o
# mesmo id, em qualquer execução, sem precisar hardcodar um UUID literal.
_EXERCISE_ID_NAMESPACE = uuid.uuid5(uuid.NAMESPACE_URL, "https://gymnight.app/catalog/exercises")

# Namespace fixo para os 7 grupos musculares (Wave 6).
_MUSCLE_GROUP_ID_NAMESPACE = uuid.uuid5(uuid.NAMESPACE_URL, "https://gymnight.app/catalog/muscle_groups")

# Ordem das colunas do muscle_usage_map.md (Peito, Costas, Ombros, Bíceps,
# Tríceps, Pernas, Abdômen) — mesma ordem de `_MD_COLUMN_ORDER` no desktop.
MUSCLE_GROUP_NAMES = ["Peito", "Costas", "Ombros", "Bíceps", "Tríceps", "Pernas", "Abdômen"]

_SECTION_HEADER_RE = re.compile(r"^\|\s*\*\*.*\*\*")


def normalize_exercise_name(text: str) -> str:
    """Lowercase + remove acentos + strip — mesmo algoritmo do desktop (parser.py:233-236)."""
    nfd = unicodedata.normalize("NFD", text.lower().strip())
    return "".join(c for c in nfd if unicodedata.category(c) != "Mn")


def exercise_id_for(display_name: str) -> str:
    """Id determinístico (UUIDv5) a partir do nome normalizado do exercício."""
    return str(uuid.uuid5(_EXERCISE_ID_NAMESPACE, normalize_exercise_name(display_name)))


def muscle_group_id_for(name: str) -> str:
    """Id determinístico (UUIDv5) para um dos 7 grupos musculares fixos."""
    return str(uuid.uuid5(_MUSCLE_GROUP_ID_NAMESPACE, normalize_exercise_name(name)))


def met_value_for(display_name: str) -> float | None:
    """Valor MET do exercício, ou None se ausente do dicionário (Wave 6 §3.3)."""
    return EXERCISE_MET_MAP.get(normalize_exercise_name(display_name))


def parse_exercise_names(md_path: Path = MUSCLE_USAGE_MAP_PATH) -> list[str]:
    """
    Lê o muscle_usage_map.md e devolve os nomes de exibição (coluna 1, com
    acentuação e maiúsculas), na ordem em que aparecem, sem duplicatas (por
    nome normalizado).

    Regras de parsing, idênticas ao desktop:
    - Ignora linhas que não começam com "|" (texto solto fora de tabela).
    - Ignora a linha separadora (contém ":---").
    - Ignora linhas de seção em negrito (`| **PEITO (Chest)** | ... |`).
    - Ignora a linha de cabeçalho ("Exercício (Canônico)").
    """
    path = Path(md_path)
    if not path.exists():
        raise FileNotFoundError(f"Arquivo não encontrado: {path}")

    seen_normalized: set[str] = set()
    names: list[str] = []

    with path.open(encoding="utf-8") as f:
        for raw_line in f:
            line = raw_line.strip()

            if not line.startswith("|"):
                continue
            if ":---" in line:
                continue
            if _SECTION_HEADER_RE.match(line):
                continue

            cells = [c.strip() for c in line.split("|")]
            cells = [c for c in cells if c != ""]

            if len(cells) < 8:
                continue

            display_name = cells[0]
            if not display_name or display_name.lower().startswith("exerc"):
                continue

            normalized = normalize_exercise_name(display_name)
            if normalized in seen_normalized:
                continue
            seen_normalized.add(normalized)
            names.append(display_name)

    return names


def parse_muscle_contributions(
    md_path: Path = MUSCLE_USAGE_MAP_PATH,
) -> list[tuple[str, str, float]]:
    """
    Lê o muscle_usage_map.md e devolve (exercise_display_name, muscle_group_name,
    contribution) por combinação com ativação > 0 — percentuais convertidos
    para decimal (70 → 0.7), músculos com contribuição 0 são ignorados
    (Wave 6 §3.1). Mesmas regras de parsing de `parse_exercise_names`.
    """
    path = Path(md_path)
    if not path.exists():
        raise FileNotFoundError(f"Arquivo não encontrado: {path}")

    records: list[tuple[str, str, float]] = []

    with path.open(encoding="utf-8") as f:
        for raw_line in f:
            line = raw_line.strip()

            if not line.startswith("|"):
                continue
            if ":---" in line:
                continue
            if _SECTION_HEADER_RE.match(line):
                continue

            cells = [c.strip() for c in line.split("|")]
            cells = [c for c in cells if c != ""]

            if len(cells) < 8:
                continue

            display_name = cells[0]
            if not display_name or display_name.lower().startswith("exerc"):
                continue

            for idx, group_name in enumerate(MUSCLE_GROUP_NAMES):
                raw_pct = cells[idx + 1].replace("%", "").strip()
                try:
                    pct = float(raw_pct)
                except ValueError:
                    continue
                if pct <= 0:
                    continue
                contribution = round(pct / 100.0, 4)
                records.append((display_name, group_name, contribution))

    return records
