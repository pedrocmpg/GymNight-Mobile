# ============================================================================
# SCHEMAS PYDANTIC PARA PERFIL DE USUÁRIO (pós-migração Supabase)
# ============================================================================
# O cadastro e login agora ocorrem no frontend via SDK do Supabase Auth.
# Estes schemas tratam exclusivamente do perfil do usuário (dados não-auth).
#
# SCHEMAS:
# - UserProfileCreate:  Criação de perfil após registro no Supabase Auth
# - UserProfileUpdate:  Atualização parcial de perfil (todos campos opcionais)
# - UserProfileResponse: Resposta com dados públicos do perfil
# ============================================================================

import re
from datetime import date
from pydantic import BaseModel, ConfigDict, field_validator
from typing import Optional


class UserProfileCreate(BaseModel):
    """Cria perfil após registro bem-sucedido no Supabase Auth."""
    model_config = ConfigDict(extra="forbid")  # Rejeita campos extras como `password` com HTTP 422

    name: str                          # obrigatório na criação
    weight: Optional[float] = None     # 1.0–500.0 kg
    height: Optional[float] = None     # 50.0–300.0 cm
    birth_date: Optional[str] = None   # ISO 8601 YYYY-MM-DD
    gender: Optional[str] = None       # "male" | "female" | "other"

    @field_validator("weight")
    @classmethod
    def validate_weight(cls, v: Optional[float]) -> Optional[float]:
        if v is not None and not (1.0 <= v <= 500.0):
            raise ValueError("weight must be between 1.0 and 500.0 kg")
        return v

    @field_validator("height")
    @classmethod
    def validate_height(cls, v: Optional[float]) -> Optional[float]:
        if v is not None and not (50.0 <= v <= 300.0):
            raise ValueError("height must be between 50.0 and 300.0 cm")
        return v

    @field_validator("birth_date")
    @classmethod
    def validate_birth_date(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", v):
            raise ValueError("birth_date must be in YYYY-MM-DD format")
        try:
            parsed = date.fromisoformat(v)
        except ValueError:
            raise ValueError("birth_date must be in YYYY-MM-DD format")
        if parsed > date.today():
            raise ValueError("birth_date must not be a future date")
        return v

    @field_validator("gender")
    @classmethod
    def validate_gender(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in {"male", "female", "other"}:
            raise ValueError("gender must be one of: male, female, other")
        return v


class UserProfileUpdate(BaseModel):
    """Atualização parcial de perfil. Todos os campos opcionais."""
    model_config = ConfigDict(extra="forbid")

    name: Optional[str] = None
    weight: Optional[float] = None
    height: Optional[float] = None
    birth_date: Optional[str] = None
    gender: Optional[str] = None

    @field_validator("weight")
    @classmethod
    def validate_weight(cls, v: Optional[float]) -> Optional[float]:
        if v is not None and not (1.0 <= v <= 500.0):
            raise ValueError("weight must be between 1.0 and 500.0 kg")
        return v

    @field_validator("height")
    @classmethod
    def validate_height(cls, v: Optional[float]) -> Optional[float]:
        if v is not None and not (50.0 <= v <= 300.0):
            raise ValueError("height must be between 50.0 and 300.0 cm")
        return v

    @field_validator("birth_date")
    @classmethod
    def validate_birth_date(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", v):
            raise ValueError("birth_date must be in YYYY-MM-DD format")
        try:
            parsed = date.fromisoformat(v)
        except ValueError:
            raise ValueError("birth_date must be in YYYY-MM-DD format")
        if parsed > date.today():
            raise ValueError("birth_date must not be a future date")
        return v

    @field_validator("gender")
    @classmethod
    def validate_gender(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in {"male", "female", "other"}:
            raise ValueError("gender must be one of: male, female, other")
        return v


class UserProfileResponse(BaseModel):
    id: str
    name: Optional[str] = None
    email: Optional[str] = None
    weight: Optional[float] = None
    height: Optional[float] = None
    birth_date: Optional[str] = None
    gender: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)
