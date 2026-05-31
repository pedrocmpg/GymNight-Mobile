# ============================================================================
# ROTEADOR DE AUTENTICAÇÃO
# ============================================================================
# Este módulo contém todas as rotas relacionadas à autenticação:
# - Login tradicional (email + senha)
# - Login com Google (implementação futura)
# - Refresh token (implementação futura)
#
# SEPARAÇÃO DE RESPONSABILIDADES:
# - Este roteador cuida apenas de AUTENTICAÇÃO (login, tokens)
# - Gerenciamento de usuários (cadastro, perfil) fica no roteador users.py
# ============================================================================

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from app.database.connection import get_db
from app.database import models
from app.schemas.user import UserLogin
from app.core.security import verify_password, create_access_token

# ============================================================================
# CRIAÇÃO DO ROTEADOR
# ============================================================================
# APIRouter() cria um roteador modular que será incluído no app principal.
#
# PARÂMETROS:
# - prefix="/auth": Todas as rotas deste roteador começam com /auth
# - tags=["auth"]: Agrupa rotas na documentação Swagger (/docs)
#
# VANTAGENS:
# - Organização: Rotas de autenticação ficam separadas de CRUD de usuários
# - Manutenção: Fácil encontrar e modificar rotas de login
# - Documentação: Swagger agrupa rotas por tags
# - Segurança: Facilita aplicar middlewares específicos de autenticação
# ============================================================================
router = APIRouter(
    prefix="/auth",
    tags=["auth"]
)


@router.post("/login")
def login_traditional(credentials: UserLogin, db: Session = Depends(get_db)):
    """
    Autentica usuário com email e senha tradicionais e retorna token JWT.
    
    FLUXO DE AUTENTICAÇÃO:
    ----------------------
    1. FastAPI valida formato de email e presença de senha (schema UserLogin)
    2. Busca usuário no banco pelo email fornecido
    3. Verifica se senha fornecida corresponde ao hash armazenado (bcrypt)
    4. Gera token JWT assinado com dados do usuário
    5. Retorna token + tipo + dados do usuário
    
    SEGURANÇA:
    ----------
    - Sempre retorna mensagem genérica "Credenciais inválidas" para:
      * Email não encontrado
      * Senha incorreta
    - Isso impede ENUMERAÇÃO DE USUÁRIOS (atacante não descobre quais emails existem)
    - Usa bcrypt.checkpw() que é resistente a timing attacks
    - Token JWT expira após 30 minutos (configurável em config.py)
    
    TRATAMENTO DE ERROS:
    --------------------
    - Email não encontrado: 401 Unauthorized
    - Senha incorreta: 401 Unauthorized (mesma mensagem por segurança)
    - Formato inválido: 422 Unprocessable Entity (validação Pydantic)
    - Erro no banco: 500 Internal Server Error
    
    Args:
        credentials (UserLogin): Email e senha fornecidos pelo app móvel
        db (Session): Sessão do banco injetada automaticamente pelo FastAPI
    
    Returns:
        dict: {
            "access_token": "eyJhbGc...",  # Token JWT assinado
            "token_type": "bearer",         # Tipo do token (padrão OAuth2)
            "user": {                       # Dados públicos do usuário
                "id": "uuid-aqui",
                "name": "Nome do Usuário",
                "email": "email@exemplo.com"
            }
        }
    
    Raises:
        HTTPException 401: Se credenciais inválidas (email não existe ou senha errada)
        HTTPException 500: Se houver erro no banco de dados
    """
    # ========================================================================
    # PASSO 1: BUSCAR USUÁRIO PELO EMAIL
    # ========================================================================
    # Consulta SQL gerada: SELECT * FROM users WHERE email = 'email_fornecido' LIMIT 1
    # .first() retorna None se não encontrar, ou objeto User se encontrar
    user = db.query(models.User).filter(models.User.email == credentials.email).first()
    
    # ========================================================================
    # PASSO 2: VERIFICAR SE USUÁRIO EXISTE
    # ========================================================================
    # Se user é None, significa que o email não está cadastrado no banco
    #
    # IMPORTANTE - SEGURANÇA:
    # Retornamos mensagem genérica "Credenciais inválidas" em vez de
    # "Email não encontrado" para evitar ENUMERAÇÃO DE USUÁRIOS.
    #
    # O QUE É ENUMERAÇÃO DE USUÁRIOS?
    # Se retornássemos mensagens diferentes para "email não existe" vs "senha errada",
    # um atacante poderia descobrir quais emails estão cadastrados no sistema:
    #
    # Cenário de ataque:
    # 1. Atacante tenta login com "admin@empresa.com" + senha aleatória
    # 2. Se retornar "Email não encontrado" → atacante sabe que esse email NÃO existe
    # 3. Se retornar "Senha incorreta" → atacante sabe que esse email EXISTE
    # 4. Atacante repete para milhares de emails e monta lista de usuários válidos
    # 5. Com a lista, atacante pode fazer ataques direcionados (phishing, força bruta)
    #
    # SOLUÇÃO:
    # Sempre retornar a MESMA mensagem genérica "Credenciais inválidas"
    # tanto para email inexistente quanto para senha errada.
    if not user:
        raise HTTPException(
            status_code=401,
            detail="Credenciais inválidas"  # Mensagem genérica intencional
        )
    
    # ========================================================================
    # PASSO 3: VALIDAR A SENHA FORNECIDA
    # ========================================================================
    # verify_password() usa bcrypt para comparar de forma segura:
    # 1. Converte senha fornecida e hash armazenado para bytes
    # 2. Usa bcrypt.checkpw() para comparar
    # 3. Retorna True se senha correta, False se senha incorreta
    #
    # DETALHES TÉCNICOS:
    # - credentials.password: senha em texto plano digitada pelo usuário
    # - user.senha_hash: hash bcrypt armazenado no banco durante o cadastro
    # - bcrypt extrai o salt do hash e refaz o processo de hashing
    # - Se os hashes coincidirem, a senha está correta
    password_is_valid = verify_password(credentials.password, user.senha_hash)
    
    # ========================================================================
    # PASSO 4: REJEITAR SE SENHA INCORRETA
    # ========================================================================
    # Se verify_password retornou False, a senha está errada
    #
    # IMPORTANTE - SEGURANÇA:
    # Retornamos a MESMA mensagem de erro do email inválido.
    # Isso impede que atacantes descubram quais emails existem no sistema.
    if not password_is_valid:
        raise HTTPException(
            status_code=401,
            detail="Credenciais inválidas"  # Mesma mensagem genérica
        )
    
    # ========================================================================
    # PASSO 5: GERAR TOKEN JWT
    # ========================================================================
    # create_access_token() gera um token JWT assinado contendo:
    # - user_id: UUID do usuário (identificador único)
    # - email: Email do usuário (para referência)
    # - exp: Timestamp de expiração (30 minutos no futuro)
    #
    # ESTRUTURA DO TOKEN:
    # {
    #   "user_id": "123e4567-e89b-12d3-a456-426614174000",
    #   "email": "usuario@gmail.com",
    #   "exp": 1709568000  // Expira em 30 minutos
    # }
    #
    # O token é assinado com SECRET_KEY usando HMAC-SHA256.
    # Apenas quem tem a SECRET_KEY pode gerar tokens válidos.
    access_token = create_access_token(
        data={
            "user_id": str(user.id),  # Converte UUID para string
            "email": user.email
        }
    )
    
    # ========================================================================
    # PASSO 6: RETORNAR TOKEN + DADOS DO USUÁRIO
    # ========================================================================
    # Retorna:
    # - access_token: Token JWT para usar em requisições futuras
    # - token_type: "bearer" (padrão OAuth2, usado no header Authorization)
    # - user: Dados públicos do usuário (id, name, email)
    #
    # USO NO APP MÓVEL:
    # 1. App armazena access_token no AsyncStorage/SecureStore
    # 2. Todas as requisições futuras incluem: Authorization: Bearer <token>
    # 3. Backend valida o token em rotas protegidas (middleware)
    # 4. Se token expirar, app redireciona para tela de login
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": str(user.id),
            "name": user.nome,
            "email": user.email
        }
    }
