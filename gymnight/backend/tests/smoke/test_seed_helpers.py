"""
Unit tests for app.database.seed_helpers — parsing e normalização do
muscle_usage_map.md (PARIDADE-01-DESTRAVAR.md §3.4/3.5), portados
literalmente de GymNight-Desktop/src/database/parser.py.
"""

from app.database.seed_helpers import (
    exercise_id_for,
    normalize_exercise_name,
    parse_exercise_names,
)


def test_normalize_lowercases_strips_and_removes_accents():
    assert normalize_exercise_name("Supino Reto (Barra)") == "supino reto (barra)"
    assert normalize_exercise_name("Bíceps") == "biceps"
    assert normalize_exercise_name("  Tríceps Testa  ") == "triceps testa"


def test_parse_exercise_names_yields_210_unique_names():
    names = parse_exercise_names()
    assert len(names) == 210
    normalized = [normalize_exercise_name(n) for n in names]
    assert len(normalized) == len(set(normalized)), "no duplicate exercises after normalization"


def test_parse_exercise_names_ignores_bold_section_headers():
    names = parse_exercise_names()
    # Cabeçalhos de seção como "PEITO (Chest)" não são exercícios.
    section_labels = {
        "PEITO (Chest)",
        "COSTAS (Back)",
        "OMBROS (Shoulders)",
        "BÍCEPS (Biceps)",
        "TRÍCEPS (Triceps)",
        "PERNAS (Legs)",
        "CORE (Abdômen & Estabilização)",
    }
    assert not (set(names) & section_labels)


def test_parse_exercise_names_preserves_display_casing_and_accents():
    names = parse_exercise_names()
    assert "Supino Reto (Barra)" in names
    assert "Bíceps" not in names  # not an exercise name itself, just a sanity check on accents
    assert any("í" in n or "é" in n or "ê" in n or "ã" in n for n in names), (
        "display names must keep accents (only the normalized key drops them)"
    )


def test_exercise_id_for_is_deterministic():
    a = exercise_id_for("Supino Reto (Barra)")
    b = exercise_id_for("Supino Reto (Barra)")
    assert a == b


def test_exercise_id_for_is_stable_across_casing_and_whitespace():
    # Normalização entra na chave do id — variações de forma não devem gerar
    # ids diferentes (mesmo exercício, mesmo id).
    a = exercise_id_for("Supino Reto (Barra)")
    b = exercise_id_for("  supino reto (barra)  ")
    assert a == b


def test_exercise_id_for_differs_between_distinct_exercises():
    names = parse_exercise_names()
    ids = {exercise_id_for(n) for n in names}
    assert len(ids) == len(names)
