"""Make users.email nullable (remove NOT NULL constraint)

Revision ID: 007
Revises: 006
Description:
    Removes the NOT NULL constraint on users.email. Does not change the
    column's type, default, or the existing unique index (ix_users_email).
    Does not touch the User SQLAlchemy model, UserProfileCreate schema, or
    the POST /users route handler (Requirement 12.5).

Requirements: 12.1, 12.2, 12.5
"""

from alembic import op


# revision identifiers, used by Alembic
revision = "007"
down_revision = "006"
branch_labels = None
depends_on = None


def upgrade():
    """Drop NOT NULL constraint on users.email."""
    op.alter_column("users", "email", nullable=True)


def downgrade():
    """Restore NOT NULL constraint on users.email."""
    op.alter_column("users", "email", nullable=False)
