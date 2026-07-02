"""Add offline sync triggers (tombstone infrastructure)

Revision ID: 005
Revises: 004
Description:
    Moves all offline-first sync trigger infrastructure from the SQLAlchemy
    event listener system (after_create) into the deterministic Alembic pipeline.

    What this migration does (upgrade):
    1. Ensures the deleted_records table exists with the correct schema.
    2. Creates (or replaces) the PL/pgSQL function create_tombstone_on_delete().
    3. Attaches AFTER DELETE FOR EACH ROW triggers to the 4 syncable WatermelonDB
       tables using the DROP + CREATE strategy (idempotent on any PostgreSQL version):
         - workouts          → trg_tombstone_workouts
         - workout_sessions  → trg_tombstone_workout_sessions
         - logged_sets       → trg_tombstone_logged_sets
         - exercises         → trg_tombstone_exercises

    What the downgrade does:
    - Removes the 4 triggers created above (DROP TRIGGER IF EXISTS).
    - Removes the function create_tombstone_on_delete() (DROP FUNCTION IF EXISTS).
    - Does NOT remove the deleted_records table — historical tombstones have
      audit value and cannot be recreated retroactively.

Based on the original standalone migration script:
    app/database/migrations/005_add_offline_sync_triggers.py
"""

from alembic import op


# revision identifiers, used by Alembic
revision = "005"
down_revision = "004"
branch_labels = None
depends_on = None


# ============================================================================
# SQL: Ensure deleted_records table exists
# ============================================================================
_CREATE_DELETED_RECORDS_SQL = """
CREATE TABLE IF NOT EXISTS deleted_records (
    id         VARCHAR(36)  NOT NULL,
    table_name VARCHAR(255) NOT NULL,
    record_id  VARCHAR(36)  NOT NULL,
    user_id    VARCHAR(36)  NULL,
    deleted_at BIGINT       NOT NULL,
    CONSTRAINT pk_deleted_records PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_deleted_records_deleted_at
    ON deleted_records (deleted_at);

CREATE INDEX IF NOT EXISTS idx_deleted_records_table_name
    ON deleted_records (table_name);

CREATE INDEX IF NOT EXISTS idx_deleted_records_user_deleted_at
    ON deleted_records (user_id, deleted_at);
"""

# ============================================================================
# SQL: PL/pgSQL tombstone function
# ============================================================================
_CREATE_TOMBSTONE_FUNCTION_SQL = """
CREATE OR REPLACE FUNCTION create_tombstone_on_delete()
RETURNS TRIGGER AS $$
DECLARE
    v_user_id TEXT;
BEGIN
    IF TG_TABLE_NAME = 'exercises' THEN
        v_user_id := NULL;
    ELSE
        BEGIN
            EXECUTE format('SELECT ($1).user_id::text') USING OLD INTO v_user_id;
        EXCEPTION WHEN OTHERS THEN
            v_user_id := NULL;
        END;
    END IF;

    INSERT INTO deleted_records (id, table_name, record_id, user_id, deleted_at)
    VALUES (
        gen_random_uuid()::text,
        TG_TABLE_NAME,
        OLD.id,
        v_user_id,
        floor(EXTRACT(EPOCH FROM NOW()) * 1000)::bigint
    );

    RETURN OLD;
END;
$$ LANGUAGE plpgsql;
"""

# ============================================================================
# SQL: DROP + CREATE for each trigger (idempotent on PostgreSQL)
# ============================================================================
_DROP_TRIGGER_WORKOUTS = "DROP TRIGGER IF EXISTS trg_tombstone_workouts ON workouts;"
_CREATE_TRIGGER_WORKOUTS = """
CREATE TRIGGER trg_tombstone_workouts
AFTER DELETE ON workouts
FOR EACH ROW
EXECUTE FUNCTION create_tombstone_on_delete();
"""

_DROP_TRIGGER_WORKOUT_SESSIONS = (
    "DROP TRIGGER IF EXISTS trg_tombstone_workout_sessions ON workout_sessions;"
)
_CREATE_TRIGGER_WORKOUT_SESSIONS = """
CREATE TRIGGER trg_tombstone_workout_sessions
AFTER DELETE ON workout_sessions
FOR EACH ROW
EXECUTE FUNCTION create_tombstone_on_delete();
"""

_DROP_TRIGGER_LOGGED_SETS = (
    "DROP TRIGGER IF EXISTS trg_tombstone_logged_sets ON logged_sets;"
)
_CREATE_TRIGGER_LOGGED_SETS = """
CREATE TRIGGER trg_tombstone_logged_sets
AFTER DELETE ON logged_sets
FOR EACH ROW
EXECUTE FUNCTION create_tombstone_on_delete();
"""

_DROP_TRIGGER_EXERCISES = (
    "DROP TRIGGER IF EXISTS trg_tombstone_exercises ON exercises;"
)
_CREATE_TRIGGER_EXERCISES = """
CREATE TRIGGER trg_tombstone_exercises
AFTER DELETE ON exercises
FOR EACH ROW
EXECUTE FUNCTION create_tombstone_on_delete();
"""


def upgrade():
    """Apply the entire tombstone / trigger infrastructure to the database."""
    # Step 1: Ensure the deleted_records table and its indexes exist
    op.execute(_CREATE_DELETED_RECORDS_SQL)

    # Step 2: Create (or replace) the PL/pgSQL tombstone function
    op.execute(_CREATE_TOMBSTONE_FUNCTION_SQL)

    # Steps 3–6: DROP + CREATE for each trigger (idempotent)
    op.execute(_DROP_TRIGGER_WORKOUTS)
    op.execute(_CREATE_TRIGGER_WORKOUTS)

    op.execute(_DROP_TRIGGER_WORKOUT_SESSIONS)
    op.execute(_CREATE_TRIGGER_WORKOUT_SESSIONS)

    op.execute(_DROP_TRIGGER_LOGGED_SETS)
    op.execute(_CREATE_TRIGGER_LOGGED_SETS)

    op.execute(_DROP_TRIGGER_EXERCISES)
    op.execute(_CREATE_TRIGGER_EXERCISES)


def downgrade():
    """Remove the 4 triggers and the tombstone function.

    The deleted_records table is NOT removed — historical tombstones cannot
    be recreated retroactively and have audit value.
    """
    op.execute("DROP TRIGGER IF EXISTS trg_tombstone_exercises ON exercises;")
    op.execute("DROP TRIGGER IF EXISTS trg_tombstone_logged_sets ON logged_sets;")
    op.execute(
        "DROP TRIGGER IF EXISTS trg_tombstone_workout_sessions ON workout_sessions;"
    )
    op.execute("DROP TRIGGER IF EXISTS trg_tombstone_workouts ON workouts;")
    op.execute("DROP FUNCTION IF EXISTS create_tombstone_on_delete();")
