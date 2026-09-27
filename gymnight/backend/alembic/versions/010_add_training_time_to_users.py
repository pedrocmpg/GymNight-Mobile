"""Add training_time field to users

Revision ID: 010
Revises: 009
Description:
    Adds one optional profile column to the users table to support the
    onboarding "tempo de treino" step:
      - training_time  VARCHAR(20)  nullable  (one of: "Nunca treinei",
        "Até 6 meses", "6 meses a 2 anos", "Mais de 2 anos", validated by ORM)
"""

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic
revision = "010"
down_revision = "009"
branch_labels = None
depends_on = None


def upgrade():
    """Add training_time column to users."""
    op.add_column("users", sa.Column("training_time", sa.String(20), nullable=True))


def downgrade():
    """Remove training_time column from users."""
    op.drop_column("users", "training_time")
