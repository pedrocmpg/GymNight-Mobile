"""Exercise catalog 500 (media + PT/EN names)

Revision ID: 011
Revises: 010
Description:
    Troca o catálogo de 210 exercícios (muscle_usage_map.md, só nome) pelos
    500 de `seed_data/exercise_catalog.csv`, que trazem nome em inglês,
    equipamento e a chave da mídia (miniatura + animação embutidas no app).

    1. Colunas novas em `exercises`, todas nullable:
       - name_en    VARCHAR(255)
       - equipment  VARCHAR(50)   (rótulo em PT; o app traduz)
       - media_key  VARCHAR(20)   (o `id` do CSV, ex.: "0025")

    2. Apaga os exercícios antigos que não existem no CSV. Decisão do usuário:
       os dados de treino que os usam eram só de teste, então vão junto:
       - workout_sessions com alguma série de um exercício antigo (cascade
         leva logged_sets e cardio_logs da sessão);
       - workouts com algum exercício antigo (cascade leva workout_exercises).
       Os triggers da migration 005 geram os tombstones de workouts, sessões,
       séries, cardio e exercícios. Os 12 nomes antigos que coincidem com o
       CSV (mesmo UUIDv5) são mantidos e só atualizados.

    3. exercise_muscle_map / exercise_met_values passam a seguir o CSV (regra
       70/30, ver seed_helpers). Essas tabelas não têm trigger de tombstone,
       então as linhas removidas ganham tombstone explícito (user_id NULL)
       para os clientes as apagarem no próximo pull.

    4. Upsert dos 500 com updated_at = agora, para o pull incremental levar
       o catálogo novo a quem já sincronizou.

    Downgrade: remove os 500 e as colunas. Os dados de teste apagados no
    passo 2 e o catálogo antigo NÃO voltam — rode `alembic downgrade 008`
    + `upgrade 010` num banco limpo se precisar do estado anterior.

Requirements: plano "Catálogo de 500 exercícios com imagem, GIF e idioma PT/EN"
"""
import time
import uuid

import sqlalchemy as sa
from alembic import op

from app.database.seed_helpers import muscle_group_id_for, parse_exercise_catalog_csv

# revision identifiers, used by Alembic
revision = "011"
down_revision = "010"
branch_labels = None
depends_on = None


def _map_row_id(exercise_id: str, muscle_group_id: str) -> str:
    # Mesmo esquema de id da migration 009.
    return str(uuid.uuid5(uuid.NAMESPACE_URL, f"exercise_muscle_map:{exercise_id}:{muscle_group_id}"))


def _met_row_id(exercise_id: str) -> str:
    # Mesmo esquema de id da migration 009.
    return str(uuid.uuid5(uuid.NAMESPACE_URL, f"exercise_met_values:{exercise_id}"))


_INSERT_TOMBSTONE_SQL = sa.text(
    """
    INSERT INTO deleted_records (id, table_name, record_id, user_id, deleted_at)
    VALUES (gen_random_uuid()::text, :table_name, :record_id, NULL, :deleted_at)
    """
)


def _delete_with_tombstones(connection, table: str, keep_ids: set[str], now_ms: int) -> None:
    """Apaga as linhas de `table` fora de `keep_ids`, gravando um tombstone por linha."""
    existing = {row.id for row in connection.execute(sa.text(f"SELECT id FROM {table}"))}
    stale = existing - keep_ids
    for record_id in stale:
        connection.execute(
            _INSERT_TOMBSTONE_SQL,
            {"table_name": table, "record_id": record_id, "deleted_at": now_ms},
        )
    if stale:
        connection.execute(
            sa.text(f"DELETE FROM {table} WHERE id = ANY(:ids)"),
            {"ids": list(stale)},
        )


def upgrade():
    connection = op.get_bind()
    now_ms = int(time.time() * 1000)

    # ------------------------------------------------------------------
    # 1. Colunas novas
    # ------------------------------------------------------------------
    op.add_column("exercises", sa.Column("name_en", sa.String(255), nullable=True))
    op.add_column("exercises", sa.Column("equipment", sa.String(50), nullable=True))
    op.add_column("exercises", sa.Column("media_key", sa.String(20), nullable=True))

    catalog = parse_exercise_catalog_csv()
    new_ids = [exercise.id for exercise in catalog]

    # ------------------------------------------------------------------
    # 2. Apagar o catálogo antigo e os dados de teste que o usam
    # ------------------------------------------------------------------
    connection.execute(
        sa.text(
            """
            DELETE FROM workout_sessions WHERE id IN (
                SELECT ls.session_id FROM logged_sets ls
                WHERE NOT (ls.exercise_id = ANY(:new_ids))
            )
            """
        ),
        {"new_ids": new_ids},
    )
    connection.execute(
        sa.text(
            """
            DELETE FROM workouts WHERE id IN (
                SELECT we.workout_id FROM workout_exercises we
                WHERE NOT (we.exercise_id = ANY(:new_ids))
            )
            """
        ),
        {"new_ids": new_ids},
    )

    # Mapa e MET primeiro, com tombstone explícito; depois os exercícios
    # (o trigger da 005 grava o tombstone de cada um).
    desired_map_rows: list[dict] = []
    desired_met_rows: list[dict] = []
    for exercise in catalog:
        for group_name, contribution in exercise.muscle_contributions():
            group_id = muscle_group_id_for(group_name)
            desired_map_rows.append(
                {
                    "id": _map_row_id(exercise.id, group_id),
                    "exercise_id": exercise.id,
                    "muscle_group_id": group_id,
                    "contribution": contribution,
                    "created_at": now_ms,
                    "updated_at": now_ms,
                }
            )
        desired_met_rows.append(
            {
                "id": _met_row_id(exercise.id),
                "exercise_id": exercise.id,
                "met_value": exercise.met_value,
                "created_at": now_ms,
                "updated_at": now_ms,
            }
        )

    _delete_with_tombstones(
        connection, "exercise_muscle_map", {row["id"] for row in desired_map_rows}, now_ms
    )
    _delete_with_tombstones(
        connection, "exercise_met_values", {row["id"] for row in desired_met_rows}, now_ms
    )
    connection.execute(
        sa.text("DELETE FROM exercises WHERE NOT (id = ANY(:new_ids))"),
        {"new_ids": new_ids},
    )

    # ------------------------------------------------------------------
    # 3. Upsert dos 500, do mapa muscular e do MET
    # ------------------------------------------------------------------
    upsert_exercise_sql = sa.text(
        """
        INSERT INTO exercises (id, name, name_en, equipment, media_key, created_at, updated_at)
        VALUES (:id, :name, :name_en, :equipment, :media_key, :now, :now)
        ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            name_en = EXCLUDED.name_en,
            equipment = EXCLUDED.equipment,
            media_key = EXCLUDED.media_key,
            updated_at = EXCLUDED.updated_at
        """
    )
    for exercise in catalog:
        connection.execute(
            upsert_exercise_sql,
            {
                "id": exercise.id,
                "name": exercise.name,
                "name_en": exercise.name_en,
                "equipment": exercise.equipment,
                "media_key": exercise.media_key,
                "now": now_ms,
            },
        )

    upsert_map_sql = sa.text(
        """
        INSERT INTO exercise_muscle_map
            (id, exercise_id, muscle_group_id, contribution, created_at, updated_at)
        VALUES (:id, :exercise_id, :muscle_group_id, :contribution, :created_at, :updated_at)
        ON CONFLICT (id) DO UPDATE SET
            contribution = EXCLUDED.contribution,
            updated_at = EXCLUDED.updated_at
        """
    )
    for row in desired_map_rows:
        connection.execute(upsert_map_sql, row)

    upsert_met_sql = sa.text(
        """
        INSERT INTO exercise_met_values (id, exercise_id, met_value, created_at, updated_at)
        VALUES (:id, :exercise_id, :met_value, :created_at, :updated_at)
        ON CONFLICT (id) DO UPDATE SET
            met_value = EXCLUDED.met_value,
            updated_at = EXCLUDED.updated_at
        """
    )
    for row in desired_met_rows:
        connection.execute(upsert_met_sql, row)


def downgrade():
    connection = op.get_bind()
    new_ids = [exercise.id for exercise in parse_exercise_catalog_csv()]

    # Mesma ordem do upgrade: dados que referenciam o catálogo antes dele.
    connection.execute(
        sa.text(
            """
            DELETE FROM workout_sessions WHERE id IN (
                SELECT session_id FROM logged_sets WHERE exercise_id = ANY(:ids)
            )
            """
        ),
        {"ids": new_ids},
    )
    connection.execute(
        sa.text(
            """
            DELETE FROM workouts WHERE id IN (
                SELECT workout_id FROM workout_exercises WHERE exercise_id = ANY(:ids)
            )
            """
        ),
        {"ids": new_ids},
    )
    # CASCADE leva exercise_muscle_map e exercise_met_values.
    connection.execute(sa.text("DELETE FROM exercises WHERE id = ANY(:ids)"), {"ids": new_ids})

    op.drop_column("exercises", "media_key")
    op.drop_column("exercises", "equipment")
    op.drop_column("exercises", "name_en")
