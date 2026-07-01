"""Initial schema — creates all core tables

Revision ID: 001
Revises: (none — first migration)
Description:
    Creates the complete initial database schema for GymNight backend:
    - users (with password_hash, before Supabase Auth migration)
    - exercises
    - workouts
    - workout_exercises
    - workout_sessions (with DateTime timestamps, before BigInteger migration)
    - logged_sets (with DateTime timestamps, before BigInteger migration)

    All tables use String(36) UUID primary keys for offline-first compatibility
    with the WatermelonDB Sync Protocol.
"""

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic
revision = "001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    """Create all initial tables."""

    # ------------------------------------------------------------------
    # users
    # ------------------------------------------------------------------
    op.create_table(
        "users",
        sa.Column("id", sa.String(36), primary_key=True, nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=True),
        sa.Column("created_at", sa.BigInteger(), nullable=False),
        sa.Column("updated_at", sa.BigInteger(), nullable=False),
        sa.Column("_status", sa.String(10), nullable=True),
        sa.Column("_changed", sa.String(500), nullable=True),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    # ------------------------------------------------------------------
    # exercises
    # ------------------------------------------------------------------
    op.create_table(
        "exercises",
        sa.Column("id", sa.String(36), primary_key=True, nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("created_at", sa.BigInteger(), nullable=False),
        sa.Column("updated_at", sa.BigInteger(), nullable=False),
        sa.Column("_status", sa.String(10), nullable=True),
        sa.Column("_changed", sa.String(500), nullable=True),
    )
    op.create_index("ix_exercises_name", "exercises", ["name"], unique=True)

    # ------------------------------------------------------------------
    # workouts
    # ------------------------------------------------------------------
    op.create_table(
        "workouts",
        sa.Column("id", sa.String(36), primary_key=True, nullable=False),
        sa.Column(
            "user_id",
            sa.String(36),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("created_at", sa.BigInteger(), nullable=False),
        sa.Column("updated_at", sa.BigInteger(), nullable=False),
        sa.Column("_status", sa.String(10), nullable=True),
        sa.Column("_changed", sa.String(500), nullable=True),
    )

    # ------------------------------------------------------------------
    # workout_exercises
    # ------------------------------------------------------------------
    op.create_table(
        "workout_exercises",
        sa.Column("id", sa.String(36), primary_key=True, nullable=False),
        sa.Column(
            "workout_id",
            sa.String(36),
            sa.ForeignKey("workouts.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "exercise_id",
            sa.String(36),
            sa.ForeignKey("exercises.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("series_target", sa.Integer(), nullable=False),
        sa.Column("reps_target", sa.Integer(), nullable=False),
        sa.Column("weight_target", sa.Float(), nullable=False),
        sa.Column("created_at", sa.BigInteger(), nullable=False),
        sa.Column("updated_at", sa.BigInteger(), nullable=False),
        sa.Column("_status", sa.String(10), nullable=True),
        sa.Column("_changed", sa.String(500), nullable=True),
    )

    # ------------------------------------------------------------------
    # workout_sessions  (initially with DateTime timestamps)
    # ------------------------------------------------------------------
    op.create_table(
        "workout_sessions",
        sa.Column("id", sa.String(36), primary_key=True, nullable=False),
        sa.Column(
            "user_id",
            sa.String(36),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "workout_id",
            sa.String(36),
            sa.ForeignKey("workouts.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.BigInteger(), nullable=False),
        sa.Column("updated_at", sa.BigInteger(), nullable=False),
        sa.Column("_status", sa.String(10), nullable=True),
        sa.Column("_changed", sa.String(500), nullable=True),
    )

    # ------------------------------------------------------------------
    # logged_sets  (initially with DateTime timestamps)
    # ------------------------------------------------------------------
    op.create_table(
        "logged_sets",
        sa.Column("id", sa.String(36), primary_key=True, nullable=False),
        sa.Column(
            "session_id",
            sa.String(36),
            sa.ForeignKey("workout_sessions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "exercise_id",
            sa.String(36),
            sa.ForeignKey("exercises.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("weight", sa.Float(), nullable=False),
        sa.Column("repetitions", sa.Integer(), nullable=False),
        sa.Column("estimated_one_rm", sa.Float(), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.BigInteger(), nullable=False),
        sa.Column("updated_at", sa.BigInteger(), nullable=False),
        sa.Column("_status", sa.String(10), nullable=True),
        sa.Column("_changed", sa.String(500), nullable=True),
    )


def downgrade():
    """Drop all initial tables in reverse dependency order."""
    op.drop_table("logged_sets")
    op.drop_table("workout_sessions")
    op.drop_table("workout_exercises")
    op.drop_table("workouts")
    op.drop_index("ix_exercises_name", table_name="exercises")
    op.drop_table("exercises")
    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")
