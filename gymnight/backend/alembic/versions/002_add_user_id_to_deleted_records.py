"""Add user_id column and composite index to deleted_records (placeholder)

Revision ID: 002
Revises: 001
Description:
    Placeholder migration that covers any intermediate schema changes between
    the initial schema (001) and the DateTime→BigInteger conversion (003).

    At the time this revision was created the codebase had no additional
    schema changes between 001 and 003, so this migration is intentionally
    a no-op that exists only to preserve a linear history numbering that
    matches the original standalone migration script numbering (001–006).
"""

from alembic import op


# revision identifiers, used by Alembic
revision = "002"
down_revision = "001"
branch_labels = None
depends_on = None


def upgrade():
    """No-op placeholder — no schema changes in this revision."""
    pass


def downgrade():
    """No-op placeholder — nothing to reverse."""
    pass
