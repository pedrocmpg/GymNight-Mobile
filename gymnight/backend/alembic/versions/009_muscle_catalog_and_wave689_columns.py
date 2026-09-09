"""Muscle catalog (Wave 6) + dormant columns for waves 8-9

Revision ID: 009
Revises: 008
Description:
    A única migration de schema da série PARIDADE do lado do backend
    (espelha a v1→v2 do WatermelonDB no cliente). Numa migration só:

    1. Colunas novas nas tabelas já existentes:
       - users.goal (nullable)
       - workouts.description (NOT NULL, default '')
       - workout_exercises.order_index (NOT NULL, default 0)
       - logged_sets.set_type (NOT NULL, default 'N')
       As três últimas levam `server_default` para que o ALTER TABLE já
       backfille as linhas existentes sem precisar de um passo de UPDATE
       separado.

    2. Três tabelas novas, catálogo compartilhado e PULL-ONLY (sem user_id,
       sem trigger de tombstone — o cliente nunca escreve nelas):
       - muscle_groups (7 linhas fixas)
       - exercise_muscle_map (N:N exercise↔muscle_group, contribution 0-1)
       - exercise_met_values (MET por exercício)
       Semeadas na mesma migration que as cria, a partir dos mesmos dados
       (`muscle_usage_map.md`, `met_values.py`) e do mesmo esquema de ID
       determinístico (UUIDv5) usado pela migration 008 para `exercises` —
       os FKs casam sem consultar o banco.

    3. cardio_logs — schema criado agora, consumido só na Wave 9. Ganha
       trigger de tombstone (é tabela do usuário, ao contrário das três
       acima) seguindo o padrão da migration 005.

Requirements: PARIDADE-02-CATALOGO-MUSCULAR.md
"""
import time
import uuid

import sqlalchemy as sa
from alembic import op

from app.database.seed_helpers import (
    exercise_id_for,
    met_value_for,
    muscle_group_id_for,
    parse_exercise_names,
    parse_muscle_contributions,
    MUSCLE_GROUP_NAMES,
)

# revision identifiers, used by Alembic
revision = "009"
down_revision = "008"
branch_labels = None
depends_on = None


_CREATE_TRIGGER_CARDIO_LOGS_SQL = """
DROP TRIGGER IF EXISTS trg_tombstone_cardio_logs ON cardio_logs;
CREATE TRIGGER trg_tombstone_cardio_logs
AFTER DELETE ON cardio_logs
FOR EACH ROW
EXECUTE FUNCTION create_tombstone_on_delete();
"""


def upgrade():
    now_ms = int(time.time() * 1000)
    connection = op.get_bind()

    # ------------------------------------------------------------------
    # 1. Colunas novas nas tabelas existentes
    # ------------------------------------------------------------------
    op.add_column("users", sa.Column("goal", sa.String(255), nullable=True))
    op.add_column(
        "workouts",
        sa.Column("description", sa.String(1000), nullable=False, server_default=""),
    )
    op.add_column(
        "workout_exercises",
        sa.Column("order_index", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "logged_sets",
        sa.Column("set_type", sa.String(1), nullable=False, server_default="N"),
    )

    # ------------------------------------------------------------------
    # 2. Tabelas novas — catálogo (pull-only) + cardio_logs (do usuário)
    # ------------------------------------------------------------------
    op.create_table(
        "muscle_groups",
        sa.Column("id", sa.String(36), primary_key=True, nullable=False),
        sa.Column("name", sa.String(50), nullable=False, unique=True),
        sa.Column("created_at", sa.BigInteger(), nullable=False),
        sa.Column("updated_at", sa.BigInteger(), nullable=False),
        sa.Column("_status", sa.String(10), nullable=True),
        sa.Column("_changed", sa.String(500), nullable=True),
    )
    op.create_table(
        "exercise_muscle_map",
        sa.Column("id", sa.String(36), primary_key=True, nullable=False),
        sa.Column(
            "exercise_id", sa.String(36),
            sa.ForeignKey("exercises.id", ondelete="CASCADE"), nullable=False,
        ),
        sa.Column(
            "muscle_group_id", sa.String(36),
            sa.ForeignKey("muscle_groups.id", ondelete="CASCADE"), nullable=False,
        ),
        sa.Column("contribution", sa.Float(), nullable=False),
        sa.Column("created_at", sa.BigInteger(), nullable=False),
        sa.Column("updated_at", sa.BigInteger(), nullable=False),
        sa.Column("_status", sa.String(10), nullable=True),
        sa.Column("_changed", sa.String(500), nullable=True),
    )
    op.create_index(
        "ix_exercise_muscle_map_exercise_id", "exercise_muscle_map", ["exercise_id"]
    )
    op.create_index(
        "ix_exercise_muscle_map_muscle_group_id", "exercise_muscle_map", ["muscle_group_id"]
    )
    op.create_table(
        "exercise_met_values",
        sa.Column("id", sa.String(36), primary_key=True, nullable=False),
        sa.Column(
            "exercise_id", sa.String(36),
            sa.ForeignKey("exercises.id", ondelete="CASCADE"), nullable=False,
        ),
        sa.Column("met_value", sa.Float(), nullable=False),
        sa.Column("created_at", sa.BigInteger(), nullable=False),
        sa.Column("updated_at", sa.BigInteger(), nullable=False),
        sa.Column("_status", sa.String(10), nullable=True),
        sa.Column("_changed", sa.String(500), nullable=True),
    )
    op.create_index(
        "ix_exercise_met_values_exercise_id", "exercise_met_values", ["exercise_id"]
    )
    op.create_table(
        "cardio_logs",
        sa.Column("id", sa.String(36), primary_key=True, nullable=False),
        sa.Column(
            "session_id", sa.String(36),
            sa.ForeignKey("workout_sessions.id", ondelete="CASCADE"), nullable=False,
        ),
        sa.Column("cardio_type", sa.String(100), nullable=False),
        sa.Column("duration_min", sa.Float(), nullable=False),
        sa.Column("distance_km", sa.Float(), nullable=True),
        sa.Column("pse", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.BigInteger(), nullable=False),
        sa.Column("updated_at", sa.BigInteger(), nullable=False),
        sa.Column("_status", sa.String(10), nullable=True),
        sa.Column("_changed", sa.String(500), nullable=True),
    )
    op.create_index("ix_cardio_logs_session_id", "cardio_logs", ["session_id"])
    op.execute(_CREATE_TRIGGER_CARDIO_LOGS_SQL)

    # ------------------------------------------------------------------
    # 3. Seed: 7 grupos musculares, exercise_muscle_map, exercise_met_values
    # ------------------------------------------------------------------
    insert_muscle_group_sql = sa.text(
        """
        INSERT INTO muscle_groups (id, name, created_at, updated_at)
        VALUES (:id, :name, :created_at, :updated_at)
        ON CONFLICT (id) DO NOTHING
        """
    )
    muscle_group_ids: dict[str, str] = {}
    for name in MUSCLE_GROUP_NAMES:
        group_id = muscle_group_id_for(name)
        muscle_group_ids[name] = group_id
        connection.execute(
            insert_muscle_group_sql,
            {"id": group_id, "name": name, "created_at": now_ms, "updated_at": now_ms},
        )

    # exercícios que a migration 008 já semeou — usados para checar que o FK
    # de exercise_id sempre resolve para uma linha existente.
    known_exercise_ids = {exercise_id_for(name) for name in parse_exercise_names()}

    insert_map_sql = sa.text(
        """
        INSERT INTO exercise_muscle_map
            (id, exercise_id, muscle_group_id, contribution, created_at, updated_at)
        VALUES (:id, :exercise_id, :muscle_group_id, :contribution, :created_at, :updated_at)
        ON CONFLICT (id) DO NOTHING
        """
    )
    for exercise_name, group_name, contribution in parse_muscle_contributions():
        exercise_id = exercise_id_for(exercise_name)
        if exercise_id not in known_exercise_ids:
            # Exercício presente no mapa muscular mas não no catálogo semeado
            # pela migration 008 — não deveria acontecer (mesma fonte de
            # dados), mas pular defensivamente em vez de violar o FK.
            continue
        row_id = str(
            uuid.uuid5(
                uuid.NAMESPACE_URL,
                f"exercise_muscle_map:{exercise_id}:{muscle_group_ids[group_name]}",
            )
        )
        connection.execute(
            insert_map_sql,
            {
                "id": row_id,
                "exercise_id": exercise_id,
                "muscle_group_id": muscle_group_ids[group_name],
                "contribution": contribution,
                "created_at": now_ms,
                "updated_at": now_ms,
            },
        )

    insert_met_sql = sa.text(
        """
        INSERT INTO exercise_met_values (id, exercise_id, met_value, created_at, updated_at)
        VALUES (:id, :exercise_id, :met_value, :created_at, :updated_at)
        ON CONFLICT (id) DO NOTHING
        """
    )
    for exercise_name in parse_exercise_names():
        met = met_value_for(exercise_name)
        if met is None:
            continue
        exercise_id = exercise_id_for(exercise_name)
        row_id = str(uuid.uuid5(uuid.NAMESPACE_URL, f"exercise_met_values:{exercise_id}"))
        connection.execute(
            insert_met_sql,
            {
                "id": row_id,
                "exercise_id": exercise_id,
                "met_value": met,
                "created_at": now_ms,
                "updated_at": now_ms,
            },
        )


def downgrade():
    op.execute("DROP TRIGGER IF EXISTS trg_tombstone_cardio_logs ON cardio_logs;")
    op.drop_table("cardio_logs")
    op.drop_index("ix_exercise_met_values_exercise_id", table_name="exercise_met_values")
    op.drop_table("exercise_met_values")
    op.drop_index("ix_exercise_muscle_map_muscle_group_id", table_name="exercise_muscle_map")
    op.drop_index("ix_exercise_muscle_map_exercise_id", table_name="exercise_muscle_map")
    op.drop_table("exercise_muscle_map")
    op.drop_table("muscle_groups")

    op.drop_column("logged_sets", "set_type")
    op.drop_column("workout_exercises", "order_index")
    op.drop_column("workouts", "description")
    op.drop_column("users", "goal")
