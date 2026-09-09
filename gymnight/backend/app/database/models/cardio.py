# ============================================================================
# CARDIO MODEL: cardio_logs (Wave 6 — schema criado agora, consumido na Wave 9)
# ============================================================================
"""
Entrada de cardio (avulsa ou dentro de um treino). Ownership indireta via
session_id → workout_sessions.user_id, mesmo padrão de LoggedSet.
"""

from sqlalchemy import Column, String, Float, Integer, BigInteger, ForeignKey
from sqlalchemy.orm import relationship

from app.database.connection import Base
from .utils import current_timestamp_ms


class CardioLog(Base):
    __tablename__ = "cardio_logs"

    id = Column(String(36), primary_key=True, nullable=False)
    session_id = Column(
        String(36), ForeignKey("workout_sessions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    cardio_type = Column(String(100), nullable=False)
    duration_min = Column(Float, nullable=False)
    distance_km = Column(Float, nullable=True)
    pse = Column(Integer, nullable=False)  # 1–10

    created_at = Column(BigInteger, nullable=False, default=current_timestamp_ms)
    updated_at = Column(
        BigInteger, nullable=False, default=current_timestamp_ms, onupdate=current_timestamp_ms
    )
    _status = Column(String(10), nullable=True, default=None)
    _changed = Column(String(500), nullable=True, default=None)

    session = relationship("WorkoutSession")
