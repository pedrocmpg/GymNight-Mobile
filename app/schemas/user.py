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

from pydantic import BaseModel, ConfigDict
from typing import Optional


class UserProfileCreate(BaseModel):
    """Cria perfil após registro bem-sucedido no Supabase Auth."""
    model_config = ConfigDict(extra="forbid")  # Rejeita campos extras como `password` com HTTP 422

    name: Optional[str] = None        # 1–100 caracteres
    weight: Optional[float] = None    # 1.0–500.0 kg
    height: Optional[float] = None    # 50.0–300.0 cm
    birth_date: Optional[str] = None  # ISO 8601 YYYY-MM-DD
    gender: Optional[str] = None      # "male" | "female" | "other"


class UserProfileUpdate(BaseModel):
    """Atualização parcial de perfil. Todos os campos opcionais."""
    name: Optional[str] = None
    weight: Optional[float] = None
    height: Optional[float] = None
    birth_date: Optional[str] = None
    gender: Optional[str] = None


class UserProfileResponse(BaseModel):
    id: str
    name: Optional[str] = None
    weight: Optional[float] = None
    height: Optional[float] = None
    birth_date: Optional[str] = None
    gender: Optional[str] = None

    model_config = {"from_attributes": True}
