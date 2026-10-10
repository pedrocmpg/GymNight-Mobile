"""
Unit tests for parse_exercise_catalog_csv — catálogo de 500 exercícios
(migration 011): ids, grupos, regra 70/30 de contribuição, equipamento em
PT e MET.
"""

import pytest

from app.database.seed_helpers import (
    BODYWEIGHT_MET,
    DEFAULT_MET,
    MUSCLE_GROUP_NAMES,
    PRIMARY_CONTRIBUTION,
    exercise_id_for,
    met_value_for,
    parse_exercise_catalog_csv,
)

CATALOG = parse_exercise_catalog_csv()


def test_catalog_has_500_exercises():
    assert len(CATALOG) == 500


def test_ids_and_media_keys_are_unique():
    assert len({e.id for e in CATALOG}) == 500
    assert len({e.media_key for e in CATALOG}) == 500


def test_id_is_uuid5_of_pt_name():
    for exercise in CATALOG:
        assert exercise.id == exercise_id_for(exercise.name)


def test_every_exercise_has_pt_and_en_names():
    for exercise in CATALOG:
        assert exercise.name.strip()
        assert exercise.name_en.strip()


def test_first_row_is_parsed_verbatim():
    first = CATALOG[0]
    assert first.name == "Supino reto com barra"
    assert first.name_en == "Barbell Bench Press"
    assert first.media_key == "0025"
    assert first.equipment == "Barra"
    assert first.primary_group == "Peito"
    assert first.secondary_groups == ("Tríceps", "Ombros")


def test_groups_are_known_and_primary_is_not_repeated_as_secondary():
    for exercise in CATALOG:
        assert exercise.primary_group in MUSCLE_GROUP_NAMES
        assert exercise.primary_group not in exercise.secondary_groups
        assert all(g in MUSCLE_GROUP_NAMES for g in exercise.secondary_groups)


def test_contributions_sum_to_one_and_follow_70_30_rule():
    for exercise in CATALOG:
        contributions = exercise.muscle_contributions()
        assert sum(c for _, c in contributions) == pytest.approx(1.0, abs=1e-3)
        assert all(0 < c <= 1 for _, c in contributions)
        primary, primary_share = contributions[0]
        assert primary == exercise.primary_group
        expected = PRIMARY_CONTRIBUTION if exercise.secondary_groups else 1.0
        assert primary_share == pytest.approx(expected)


def test_equipment_is_always_in_portuguese():
    english = {"weighted", "wheel roller", "sled machine"}
    assert not any(e.equipment.lower() in english for e in CATALOG)
    assert {"Com carga", "Roda abdominal", "Máquina (trenó)"} <= {e.equipment for e in CATALOG}


def test_met_keeps_desktop_value_else_falls_back_by_equipment():
    for exercise in CATALOG:
        known = met_value_for(exercise.name)
        if known is not None:
            assert exercise.met_value == known
        elif exercise.equipment == "Peso corporal":
            assert exercise.met_value == BODYWEIGHT_MET
        else:
            assert exercise.met_value == DEFAULT_MET
