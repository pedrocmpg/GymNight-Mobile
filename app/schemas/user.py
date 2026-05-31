# ============================================================================
# SCHEMAS PYDANTIC PARA VALIDAÇÃO DE DADOS
# ============================================================================
# Este módulo define os schemas de validação para operações relacionadas
# a usuários (cadastro, login, respostas).
#
# SCHEMAS:
# - UserCreate: Validação de dados para cadastro de novo usuário
# - UserLogin: Validação de credenciais para login tradicional
# - GoogleLoginRequest: Validação de token para login com Google
# - UserResponse: Formato de resposta com dados públicos do usuário
# ============================================================================

from pydantic import BaseModel, EmailStr, field_validator
import re


class UserCreate(BaseModel):
    """
    Schema de validação para cadastro de novo usuário.
    
    CAMPOS OBRIGATÓRIOS:
    --------------------
    - name: Nome completo (3-50 caracteres)
    - email: Email válido (validado por EmailStr)
    - password: Senha forte (mínimo 8 chars, maiúscula, minúscula, número)
    - weight: Peso em kg (20-500 kg)
    - height: Altura em metros (0.5-3.0 m)
    - birth_date: Data de nascimento (formato string, ex: "1990-05-15")
    - gender: Gênero ('M', 'F' ou 'O')
    
    VALIDAÇÕES:
    -----------
    - Todos os campos são obrigatórios (não aceita None)
    - Validações customizadas via @field_validator
    - Mensagens de erro em português para melhor UX
    
    USO:
    ----
    Usado exclusivamente na rota POST /users (criação de conta)
    """
    name: str
    email: EmailStr
    password: str
    weight: float
    height: float
    birth_date: str
    gender: str
    
    @field_validator('password')
    @classmethod
    def validate_password(cls, v: str) -> str:
        """
        Valida força da senha.
        
        REGRAS:
        - Mínimo 8 caracteres
        - Pelo menos 1 letra maiúscula
        - Pelo menos 1 letra minúscula
        - Pelo menos 1 número
        """
        if len(v) < 8:
            raise ValueError('Senha deve ter no mínimo 8 caracteres')
        if not re.search(r'[A-Z]', v):
            raise ValueError('Senha deve conter pelo menos uma letra maiúscula')
        if not re.search(r'[a-z]', v):
            raise ValueError('Senha deve conter pelo menos uma letra minúscula')
        if not re.search(r'\d', v):
            raise ValueError('Senha deve conter pelo menos um número')
        return v
    
    @field_validator('name')
    @classmethod
    def validate_name(cls, v: str) -> str:
        """
        Valida nome do usuário.
        
        REGRAS:
        - Remove espaços extras no início/fim
        - Mínimo 3 caracteres
        - Máximo 50 caracteres
        """
        v = v.strip()
        if len(v) < 3:
            raise ValueError('Nome deve ter no mínimo 3 caracteres')
        if len(v) > 50:
            raise ValueError('Nome deve ter no máximo 50 caracteres')
        return v
    
    @field_validator('weight')
    @classmethod
    def validate_weight(cls, v: float) -> float:
        """
        Valida peso do usuário.
        
        REGRAS:
        - Deve ser positivo
        - Entre 20kg e 500kg (range realista)
        """
        if v <= 0:
            raise ValueError('Peso deve ser um valor positivo')
        if v < 20 or v > 500:
            raise ValueError('Peso deve estar entre 20kg e 500kg')
        return v
    
    @field_validator('height')
    @classmethod
    def validate_height(cls, v: float) -> float:
        """
        Valida altura do usuário.
        
        REGRAS:
        - Deve ser positiva
        - Entre 0.5m e 3.0m (range realista)
        """
        if v <= 0:
            raise ValueError('Altura deve ser um valor positivo')
        if v < 0.5 or v > 3.0:
            raise ValueError('Altura deve estar entre 0.5m e 3.0m')
        return v
    
    @field_validator('gender')
    @classmethod
    def validate_gender(cls, v: str) -> str:
        """
        Valida gênero do usuário.
        
        REGRAS:
        - Normaliza para maiúscula
        - Aceita apenas 'M', 'F' ou 'O'
        """
        v = v.strip().upper()
        if v not in ['M', 'F', 'O']:
            raise ValueError('Gênero deve ser M (masculino), F (feminino) ou O (outro)')
        return v


class UserLogin(BaseModel):
    """
    Schema de validação para login tradicional (email + senha).
    
    CAMPOS OBRIGATÓRIOS:
    --------------------
    - email: Email cadastrado (validado por EmailStr)
    - password: Senha em texto plano (será comparada com hash do banco)
    
    POR QUE APENAS EMAIL E PASSWORD?
    ---------------------------------
    - Login deve exigir apenas o mínimo necessário para autenticar
    - Dados adicionais não são relevantes para verificar identidade
    - Melhor experiência do usuário (menos campos para preencher)
    - Melhor performance (menos validações)
    
    USO:
    ----
    Usado exclusivamente na rota POST /auth/login
    """
    email: EmailStr
    password: str


class GoogleLoginRequest(BaseModel):
    """
    Schema de validação para login com Google.
    
    CAMPOS OBRIGATÓRIOS:
    --------------------
    - id_token: Token JWT assinado pelo Google (gerado no app móvel)
    
    FLUXO DE AUTENTICAÇÃO GOOGLE:
    ------------------------------
    1. App móvel usa SDK do Google para autenticar usuário
    2. SDK retorna id_token JWT assinado pelo Google
    3. App envia id_token para nossa API via POST /auth/google
    4. Backend valida token com API do Google
    5. Backend extrai dados do usuário (email, name, picture)
    6. Backend cria usuário automaticamente se não existir
    7. Backend retorna token JWT da nossa aplicação
    
    USO:
    ----
    Usado exclusivamente na rota POST /auth/google (implementação futura)
    """
    id_token: str


class UserResponse(BaseModel):
    """
    Schema de resposta com dados públicos do usuário.
    
    CAMPOS:
    -------
    - id: UUID do usuário
    - name: Nome completo
    - email: Email cadastrado
    
    SEGURANÇA:
    ----------
    - NUNCA inclui senha_hash ou outros dados sensíveis
    - Apenas dados públicos que podem ser expostos na API
    
    USO:
    ----
    Usado em respostas de rotas que retornam dados do usuário
    """
    id: str
    name: str
    email: str
    
    class Config:
        # Permite criar instância a partir de modelos SQLAlchemy
        # Exemplo: UserResponse.from_orm(user_db_object)
        from_attributes = True
