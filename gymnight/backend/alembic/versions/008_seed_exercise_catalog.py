"""Seed the shared exercise catalog (PARIDADE wave 4.5)

Revision ID: 008
Revises: 007
Description:
    Semeia a tabela `exercises` (catálogo compartilhado, sem user_id) a
    partir de `muscle_usage_map.md` — 210 exercícios portados do
    GymNight-Desktop (ver app/database/seed_helpers.py para as regras de
    parsing/normalização, idênticas às do desktop).

    Sem seed, o catálogo nasce vazio e o WorkoutCreatorScreen mostra
    "Catálogo vazio" para sempre — não dá para criar um treino em
    instalação nova (PARIDADE-01-DESTRAVAR.md §3).

    IDs são UUIDv5 determinísticos, derivados do nome normalizado
    (nfd + remove acentos + lowercase). Determinístico e não aleatório
    porque a Wave 6 semeia `exercise_muscle_map`/`exercise_met_values` com
    FKs que apontam para essas mesmas linhas, calculando o id sem precisar
    consultar o banco antes.

    Idempotente: `ON CONFLICT (id) DO NOTHING` — rodar a migration mais de
    uma vez (ex.: re-deploy) não duplica nem falha.

    O pull do sync já trata `exercises` como catálogo compartilhado
    (app/api/v1/endpoints/sync.py, sem filtro de user_id) e o push já pula
    a validação de ownership para esta tabela — nenhuma mudança de
    protocolo é necessária, só popular a tabela.

Requirements: PARIDADE-01-DESTRAVAR.md §3
"""
import time

import sqlalchemy as sa
from alembic import op

from app.database.seed_helpers import exercise_id_for, parse_exercise_names

# revision identifiers, used by Alembic
revision = "008"
down_revision = "007"
branch_labels = None
depends_on = None


def upgrade():
    """Insere os 210 exercícios do catálogo, um INSERT por linha, idempotente."""
    connection = op.get_bind()
    now_ms = int(time.time() * 1000)

    names = parse_exercise_names()

    insert_sql = sa.text(
        """
        INSERT INTO exercises (id, name, created_at, updated_at)
        VALUES (:id, :name, :created_at, :updated_at)
        ON CONFLICT (id) DO NOTHING
        """
    )

    for display_name in names:
        connection.execute(
            insert_sql,
            {
                "id": exercise_id_for(display_name),
                "name": display_name,
                "created_at": now_ms,
                "updated_at": now_ms,
            },
        )


def downgrade():
    """Remove apenas as linhas semeadas por esta migration (mesmos ids determinísticos).

    Não faz DELETE FROM exercises geral — exercícios criados depois do seed
    (pelo usuário, ou por sync) não são tocados.
    """
    connection = op.get_bind()
    names = parse_exercise_names()
    ids = [exercise_id_for(name) for name in names]

    if not ids:
        return

    delete_sql = sa.text("DELETE FROM exercises WHERE id = ANY(:ids)")
    connection.execute(delete_sql, {"ids": ids})
