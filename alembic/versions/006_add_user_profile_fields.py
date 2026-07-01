"""Add user profile fields (weight, height, birth_date, gender)

Revision ID: 006
Revises: 005
Description:
    Adds four optional profile columns to the users table to support the
    user profile feature (Requirement 1):
      - weight     FLOAT   nullable  (physiological range: [1.0, 500.0] kg, validated by ORM)
      - height     FLOAT   nullable  (physiological range: [50.0, 300.0] cm, validated by ORM)
      - birth_date VARCHAR(10) nullable  (YYYY-MM-DD format, validated by ORM)
      - gender     VARCHAR(10) nullable  (one of: male, female, other, validated by ORM)

Requirements: 1.5
"""

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic
revision = "006"
down_revision = "005"
branch_labels = None
depends_on = None


def upgrade():
    """Add weight, height, birth_date, gender columns to users."""
    op.add_column("users", sa.Column("weight", sa.Float(), nullable=True))
    op.add_column("users", sa.Column("height", sa.Float(), nullable=True))
    op.add_column("users", sa.Column("birth_date", sa.String(10), nullable=True))
    op.add_column("users", sa.Column("gender", sa.String(10), nullable=True))


def downgrade():
    """Remove weight, height, birth_date, gender columns from users."""
    op.drop_column("users", "gender")
    op.drop_column("users", "birth_date")
    op.drop_column("users", "height")
    op.drop_column("users", "weight")
