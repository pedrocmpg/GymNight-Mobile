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
import csv
import re
import unicodedata
import uuid
from dataclasses import dataclass
from pathlib import Path

from .seed_data.met_values import EXERCISE_MET_MAP

SEED_DATA_DIR = Path(__file__).resolve().parent / "seed_data"
MUSCLE_USAGE_MAP_PATH = SEED_DATA_DIR / "muscle_usage_map.md"
EXERCISE_CATALOG_CSV_PATH = SEED_DATA_DIR / "exercise_catalog.csv"

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


# ============================================================================
# Catálogo de 500 exercícios (migration 011)
# ============================================================================
# Fonte: exercise_catalog.csv (colunas id,nome_en,nome_pt,grupo_principal,
# grupos_secundarios,equipamento,imagem,gif). O `id` do CSV vira `media_key`,
# a chave que o app usa para achar a miniatura e a animação embutidas no APK.

# Contribuição muscular: o CSV só diz qual é o grupo principal e quais são os
# secundários, sem percentual. O principal fica com 70% e os secundários
# dividem 30% em partes iguais; sem secundário, o principal fica com 100%.
PRIMARY_CONTRIBUTION = 0.7

# MET quando o exercício não está no dicionário do desktop: 5.0 é o mesmo
# fallback que o cálculo de calorias já usa; peso corporal segue a faixa de
# calistenia do desktop (7.5).
DEFAULT_MET = 5.0
BODYWEIGHT_MET = 7.5
BODYWEIGHT_EQUIPMENT = "Peso corporal"

# Alguns equipamentos vieram em inglês no CSV. O banco guarda sempre o rótulo
# em PT; a tradução para EN é feita no app.
_EQUIPMENT_PT_OVERRIDES = {
    "weighted": "Com carga",
    "wheel roller": "Roda abdominal",
    "sled machine": "Máquina (trenó)",
}


@dataclass(frozen=True)
class CatalogExercise:
    id: str
    name: str
    name_en: str
    equipment: str
    media_key: str
    primary_group: str
    secondary_groups: tuple[str, ...]
    met_value: float

    def muscle_contributions(self) -> list[tuple[str, float]]:
        """(grupo, contribuição) com soma 1 — regra 70/30."""
        if not self.secondary_groups:
            return [(self.primary_group, 1.0)]
        share = round((1 - PRIMARY_CONTRIBUTION) / len(self.secondary_groups), 4)
        return [(self.primary_group, PRIMARY_CONTRIBUTION)] + [
            (group, share) for group in self.secondary_groups
        ]


def _normalize_equipment(raw: str) -> str:
    value = raw.strip()
    return _EQUIPMENT_PT_OVERRIDES.get(value.lower(), value)


def _parse_secondary_groups(raw: str, primary: str) -> tuple[str, ...]:
    groups: list[str] = []
    for part in raw.split("/"):
        group = part.strip()
        if group and group != primary and group not in groups:
            groups.append(group)
    return tuple(groups)


def parse_exercise_catalog_csv(
    csv_path: Path = EXERCISE_CATALOG_CSV_PATH,
) -> list[CatalogExercise]:
    """
    Lê o exercise_catalog.csv e devolve os exercícios na ordem do arquivo.

    O id é o mesmo UUIDv5 de sempre, a partir do `nome_pt` normalizado — um
    exercício antigo com o mesmo nome (sem acento/caixa) mantém o id.
    Levanta ValueError se um grupo muscular for desconhecido ou se dois nomes
    colidirem após a normalização.
    """
    path = Path(csv_path)
    if not path.exists():
        raise FileNotFoundError(f"Arquivo não encontrado: {path}")

    exercises: list[CatalogExercise] = []
    seen_ids: set[str] = set()

    # utf-8-sig: o CSV vem com BOM.
    with path.open(encoding="utf-8-sig", newline="") as f:
        for row in csv.DictReader(f):
            name = row["nome_pt"].strip()
            primary = row["grupo_principal"].strip()
            secondaries = _parse_secondary_groups(row["grupos_secundarios"], primary)
            for group in (primary, *secondaries):
                if group not in MUSCLE_GROUP_NAMES:
                    raise ValueError(f"Grupo muscular desconhecido {group!r} em {name!r}")

            exercise_id = exercise_id_for(name)
            if exercise_id in seen_ids:
                raise ValueError(f"Nome duplicado após normalização: {name!r}")
            seen_ids.add(exercise_id)

            equipment = _normalize_equipment(row["equipamento"])
            met = met_value_for(name)
            if met is None:
                met = BODYWEIGHT_MET if equipment == BODYWEIGHT_EQUIPMENT else DEFAULT_MET

            exercises.append(
                CatalogExercise(
                    id=exercise_id,
                    name=name,
                    name_en=row["nome_en"].strip(),
                    equipment=equipment,
                    media_key=row["id"].strip(),
                    primary_group=primary,
                    secondary_groups=secondaries,
                    met_value=met,
                )
            )

    return exercises
