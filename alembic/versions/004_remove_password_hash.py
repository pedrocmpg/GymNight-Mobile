"""Remove password_hash column from users table

Revision ID: 004
Revises: 003
Description:
    Removes the password_hash column from the users table as part of the
    migration to Supabase Auth. Password management is now fully delegated
    to Supabase Auth; the FastAPI backend only validates Supabase JWTs
    and never stores or verifies local passwords.

Based on the original standalone migration script:
    app/database/migrations/004_remove_password_hash.py

Requirements: 5.7
"""

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic
revision = "004"
down_revision = "003"
branch_labels = None
depends_on = None


def upgrade():
    """Remove password_hash from users table."""
    op.drop_column("users", "password_hash")


def downgrade():
    """Re-add password_hash to users table (nullable, for reversibility).

    Note: On rollback, the column is restored as nullable since no password
    data exists anymore — password management is now handled by Supabase Auth.
    """
    op.add_column(
        "users",
        sa.Column("password_hash", sa.String(255), nullable=True),
    )
