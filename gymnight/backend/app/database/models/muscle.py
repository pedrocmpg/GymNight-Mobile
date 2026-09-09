# ============================================================================
# MUSCLE MODELS: shared, pull-only catalog (Wave 6)
# ============================================================================
"""
muscle_groups / exercise_muscle_map / exercise_met_values — catálogos
compartilhados sem user_id, como `exercises`. O cliente nunca faz push
delas (ver app/api/v1/endpoints/sync.py): o servidor é a única fonte.
"""

from sqlalchemy import Column, String, Float, BigInteger, ForeignKey
from sqlalchemy.orm import relationship

from app.database.connection import Base
from .utils import current_timestamp_ms


class MuscleGroup(Base):
    """7 linhas fixas: Peito, Costas, Ombros, Bíceps, Tríceps, Pernas, Abdômen."""

    __tablename__ = "muscle_groups"

    id = Column(String(36), primary_key=True, nullable=False)
    name = Column(String(50), nullable=False, unique=True)

    created_at = Column(BigInteger, nullable=False, default=current_timestamp_ms)
    updated_at = Column(
        BigInteger, nullable=False, default=current_timestamp_ms, onupdate=current_timestamp_ms
    )
    _status = Column(String(10), nullable=True, default=None)
    _changed = Column(String(500), nullable=True, default=None)

    exercise_links = relationship("ExerciseMuscleMap", back_populates="muscle_group")


class ExerciseMuscleMap(Base):
    """N:N exercise↔muscle_group com ativação proporcional (`contribution`, 0–1)."""

    __tablename__ = "exercise_muscle_map"

    id = Column(String(36), primary_key=True, nullable=False)
    exercise_id = Column(
        String(36), ForeignKey("exercises.id", ondelete="CASCADE"), nullable=False, index=True
    )
    muscle_group_id = Column(
        String(36), ForeignKey("muscle_groups.id", ondelete="CASCADE"), nullable=False, index=True
    )
    contribution = Column(Float, nullable=False)  # (0, 1]

    created_at = Column(BigInteger, nullable=False, default=current_timestamp_ms)
    updated_at = Column(
        BigInteger, nullable=False, default=current_timestamp_ms, onupdate=current_timestamp_ms
    )
    _status = Column(String(10), nullable=True, default=None)
    _changed = Column(String(500), nullable=True, default=None)

    exercise = relationship("Exercise")
    muscle_group = relationship("MuscleGroup", back_populates="exercise_links")


class ExerciseMetValue(Base):
    """Valor MET por exercício, usado no cálculo de calorias de musculação."""

    __tablename__ = "exercise_met_values"

    id = Column(String(36), primary_key=True, nullable=False)
    exercise_id = Column(
        String(36), ForeignKey("exercises.id", ondelete="CASCADE"), nullable=False, index=True
    )
    met_value = Column(Float, nullable=False)

    created_at = Column(BigInteger, nullable=False, default=current_timestamp_ms)
    updated_at = Column(
        BigInteger, nullable=False, default=current_timestamp_ms, onupdate=current_timestamp_ms
    )
    _status = Column(String(10), nullable=True, default=None)
    _changed = Column(String(500), nullable=True, default=None)

    exercise = relationship("Exercise")
