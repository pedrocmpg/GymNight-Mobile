"""Convert DateTime timestamps to BigInteger Unix milliseconds

Revision ID: 003
Revises: 002
Description:
    Converts WorkoutSession (started_at, ended_at) and LoggedSet (completed_at)
    from DateTime(timezone=True) to BigInteger Unix milliseconds for consistency
    with the WatermelonDB sync protocol.

    Strategy:
    1. Add temporary BigInteger columns (*_new)
    2. Migrate existing data using EXTRACT(EPOCH FROM timestamp) * 1000
    3. Drop old DateTime columns
    4. Rename new columns to original names
    5. Restore NOT NULL constraints

    Requirements: 1.3, 2.3, 3.6

Based on the original standalone migration script:
    app/database/migrations/003_convert_datetime_to_bigint.py
"""

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic
revision = "003"
down_revision = "002"
branch_labels = None
depends_on = None


def upgrade():
    """Convert DateTime timestamps to BigInteger Unix milliseconds."""

    # ----------------------------------------------------------------
    # workout_sessions: Convert started_at and ended_at
    # ----------------------------------------------------------------

    # Step 1: Add temporary BigInteger columns
    op.add_column("workout_sessions", sa.Column("started_at_new", sa.BigInteger(), nullable=True))
    op.add_column("workout_sessions", sa.Column("ended_at_new", sa.BigInteger(), nullable=True))

    # Step 2: Migrate existing data
    op.execute("""
        UPDATE workout_sessions
        SET started_at_new = CAST(EXTRACT(EPOCH FROM started_at) * 1000 AS BIGINT)
    """)
    op.execute("""
        UPDATE workout_sessions
        SET ended_at_new = CAST(EXTRACT(EPOCH FROM ended_at) * 1000 AS BIGINT)
        WHERE ended_at IS NOT NULL
    """)

    # Step 3: Drop old DateTime columns
    op.drop_column("workout_sessions", "started_at")
    op.drop_column("workout_sessions", "ended_at")

    # Step 4: Rename new columns
    op.alter_column("workout_sessions", "started_at_new", new_column_name="started_at")
    op.alter_column("workout_sessions", "ended_at_new", new_column_name="ended_at")

    # Step 5: Restore NOT NULL on started_at (ended_at remains nullable)
    op.alter_column("workout_sessions", "started_at", nullable=False)

    # ----------------------------------------------------------------
    # logged_sets: Convert completed_at
    # ----------------------------------------------------------------

    # Step 1: Add temporary BigInteger column
    op.add_column("logged_sets", sa.Column("completed_at_new", sa.BigInteger(), nullable=True))

    # Step 2: Migrate existing data
    op.execute("""
        UPDATE logged_sets
        SET completed_at_new = CAST(EXTRACT(EPOCH FROM completed_at) * 1000 AS BIGINT)
    """)

    # Step 3: Drop old DateTime column
    op.drop_column("logged_sets", "completed_at")

    # Step 4: Rename new column
    op.alter_column("logged_sets", "completed_at_new", new_column_name="completed_at")

    # Step 5: Restore NOT NULL constraint
    op.alter_column("logged_sets", "completed_at", nullable=False)


def downgrade():
    """Convert BigInteger timestamps back to DateTime (rollback)."""

    # ----------------------------------------------------------------
    # workout_sessions: Convert started_at and ended_at back
    # ----------------------------------------------------------------

    # Add temporary DateTime columns
    op.add_column(
        "workout_sessions",
        sa.Column("started_at_new", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "workout_sessions",
        sa.Column("ended_at_new", sa.DateTime(timezone=True), nullable=True),
    )

    # Convert data back
    op.execute("""
        UPDATE workout_sessions
        SET started_at_new = TIMESTAMP 'epoch' + (started_at / 1000) * INTERVAL '1 second'
    """)
    op.execute("""
        UPDATE workout_sessions
        SET ended_at_new = TIMESTAMP 'epoch' + (ended_at / 1000) * INTERVAL '1 second'
        WHERE ended_at IS NOT NULL
    """)

    # Drop BigInteger columns
    op.drop_column("workout_sessions", "started_at")
    op.drop_column("workout_sessions", "ended_at")

    # Rename DateTime columns
    op.alter_column("workout_sessions", "started_at_new", new_column_name="started_at")
    op.alter_column("workout_sessions", "ended_at_new", new_column_name="ended_at")

    # Restore NOT NULL on started_at
    op.alter_column("workout_sessions", "started_at", nullable=False)

    # ----------------------------------------------------------------
    # logged_sets: Convert completed_at back
    # ----------------------------------------------------------------

    # Add temporary DateTime column
    op.add_column(
        "logged_sets",
        sa.Column("completed_at_new", sa.DateTime(timezone=True), nullable=True),
    )

    # Convert data back
    op.execute("""
        UPDATE logged_sets
        SET completed_at_new = TIMESTAMP 'epoch' + (completed_at / 1000) * INTERVAL '1 second'
    """)

    # Drop BigInteger column
    op.drop_column("logged_sets", "completed_at")

    # Rename DateTime column
    op.alter_column("logged_sets", "completed_at_new", new_column_name="completed_at")

    # Restore NOT NULL constraint
    op.alter_column("logged_sets", "completed_at", nullable=False)
