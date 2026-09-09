"""
Unit tests for app.database.seed_helpers — parsing e normalização do
muscle_usage_map.md (PARIDADE-01-DESTRAVAR.md §3.4/3.5), portados
literalmente de GymNight-Desktop/src/database/parser.py.
"""

from app.database.seed_helpers import (
    MUSCLE_GROUP_NAMES,
    exercise_id_for,
    met_value_for,
    muscle_group_id_for,
    normalize_exercise_name,
    parse_exercise_names,
    parse_muscle_contributions,
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


# ---------------------------------------------------------------------------
# Property 61: parsing do muscle map — 210 exercícios, seções em negrito
# ignoradas, contribuições somam ~1.0 por exercício.
# ---------------------------------------------------------------------------


def test_property_61_muscle_contributions_sum_to_one_per_exercise():
    records = parse_muscle_contributions()
    assert len(records) > 0

    sums: dict[str, float] = {}
    for name, _group, contribution in records:
        sums[name] = sums.get(name, 0.0) + contribution

    # Todo exercício do catálogo (210) precisa somar ~100% de ativação.
    assert set(sums.keys()) == set(parse_exercise_names())
    for name, total in sums.items():
        assert 0.98 <= total <= 1.02, f"{name} sums to {total}, expected ~1.0"


def test_property_61_bold_section_headers_never_appear_as_muscle_group_names():
    records = parse_muscle_contributions()
    group_names_used = {group for _name, group, _contribution in records}
    assert group_names_used <= set(MUSCLE_GROUP_NAMES)


# ---------------------------------------------------------------------------
# Property 62: contribution sempre em (0, 1]; contribuição 0 nunca vira linha.
# ---------------------------------------------------------------------------


def test_property_62_contribution_always_in_zero_one_range():
    records = parse_muscle_contributions()
    assert all(0 < contribution <= 1 for _name, _group, contribution in records)


def test_property_62_zero_contribution_cells_are_never_recorded():
    # "Supino Reto (Barra) | 65 | 0 | 15 | 0 | 20 | 0 | 0" — Costas/Bíceps/
    # Pernas/Abdômen são 0% e não devem gerar linha nenhuma para esse exercício.
    records = parse_muscle_contributions()
    groups_for_supino = {
        group for name, group, _c in records if name == "Supino Reto (Barra)"
    }
    assert groups_for_supino == {"Peito", "Ombros", "Tríceps"}


# ---------------------------------------------------------------------------
# Property 68: IDs determinísticos — mesmo nome ⇒ mesmo id, entre execuções
# repetidas e entre exercícios/grupos musculares.
# ---------------------------------------------------------------------------


def test_property_68_muscle_group_id_is_deterministic():
    for name in MUSCLE_GROUP_NAMES:
        assert muscle_group_id_for(name) == muscle_group_id_for(name)


def test_property_68_muscle_group_ids_are_all_distinct():
    ids = {muscle_group_id_for(name) for name in MUSCLE_GROUP_NAMES}
    assert len(ids) == len(MUSCLE_GROUP_NAMES)


def test_property_68_exercise_id_matches_between_repeated_calls_across_helpers():
    # A mesma exercise_id_for() é reusada tanto no seed de exercícios (migration
    # 008) quanto no seed do mapa muscular (migration 009) — este teste prova
    # que não há dependência de estado/ordem entre as duas chamadas.
    for name in parse_exercise_names()[:20]:
        first_call = exercise_id_for(name)
        second_call = exercise_id_for(name)
        assert first_call == second_call


def test_met_value_for_returns_none_for_unknown_exercise():
    assert met_value_for("Exercício Totalmente Inventado") is None
