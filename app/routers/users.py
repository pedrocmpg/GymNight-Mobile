# ============================================================================
# ROTEADOR DE GERENCIAMENTO DE USUÁRIOS
# ============================================================================
# Este módulo contém todas as rotas relacionadas ao gerenciamento de usuários:
# - Cadastro de novos usuários (Sign Up)
# - Futuras rotas: atualização de perfil, deleção de conta, etc.
#
# SEPARAÇÃO DE RESPONSABILIDADES:
# - Este roteador cuida apenas de CRUD de usuários
# - Autenticação (login) fica no roteador auth.py
# ============================================================================

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from app.database.connection import get_db
from app.database import models
from app.schemas.user import UserCreate
from app.core.security import hash_password

# ============================================================================
# CRIAÇÃO DO ROTEADOR
# ============================================================================
# APIRouter() cria um roteador modular que será incluído no app principal.
#
# PARÂMETROS:
# - prefix="/users": Todas as rotas deste roteador começam com /users
# - tags=["users"]: Agrupa rotas na documentação Swagger (/docs)
#
# VANTAGENS:
# - Organização: Rotas relacionadas ficam juntas
# - Manutenção: Fácil encontrar e modificar rotas específicas
# - Documentação: Swagger agrupa rotas por tags
# - Testabilidade: Pode testar roteadores isoladamente
# ============================================================================
router = APIRouter(
    prefix="/users",
    tags=["users"]
)


@router.post("")
def create_user(user: UserCreate, db: Session = Depends(get_db)):
    """
    Cria um novo usuário no sistema (Sign Up).
    
    FLUXO DE EXECUÇÃO:
    ------------------
    1. FastAPI valida dados de entrada usando schema UserCreate
    2. Verifica se email já está cadastrado no banco
    3. Gera hash bcrypt da senha fornecida
    4. Cria novo registro na tabela users
    5. Retorna dados públicos do usuário criado
    
    VALIDAÇÕES AUTOMÁTICAS (via UserCreate):
    -----------------------------------------
    - name: 3-50 caracteres
    - email: formato válido de email
    - password: mínimo 8 chars, maiúscula, minúscula, número
    - weight: 20-500 kg
    - height: 0.5-3.0 m
    - gender: 'M', 'F' ou 'O'
    
    SEGURANÇA:
    ----------
    - Senha é hasheada com bcrypt antes de salvar (NUNCA salvar senha em texto plano)
    - Email é único no banco (constraint UNIQUE)
    - Retorna apenas dados públicos (id, name, email) - NUNCA retorna senha_hash
    
    Args:
        user (UserCreate): Dados do novo usuário validados pelo Pydantic
        db (Session): Sessão do banco injetada automaticamente pelo FastAPI
    
    Returns:
        dict: Dados públicos do usuário criado (id, name, email)
    
    Raises:
        HTTPException 400: Se email já está cadastrado
        HTTPException 422: Se dados de entrada inválidos (validação Pydantic)
        HTTPException 500: Se houver erro no banco de dados
    """
    # ========================================================================
    # PASSO 1: VERIFICAR SE EMAIL JÁ EXISTE
    # ========================================================================
    # Consulta SQL gerada: SELECT * FROM users WHERE email = 'email_fornecido' LIMIT 1
    # .first() retorna None se não encontrar, ou objeto User se encontrar
    existing_user = db.query(models.User).filter(models.User.email == user.email).first()
    
    # Se encontrou usuário com este email, retorna erro 400
    # Mensagem genérica para não expor se email existe (segurança)
    if existing_user:
        raise HTTPException(status_code=400, detail="Email já cadastrado")
    
    # ========================================================================
    # PASSO 2: GERAR HASH BCRYPT DA SENHA
    # ========================================================================
    # NUNCA armazenar senha em texto plano no banco!
    # hash_password() usa bcrypt para gerar hash seguro com salt único
    # Exemplo de hash: "$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/..."
    hashed_password = hash_password(user.password)
    
    # ========================================================================
    # PASSO 3: CRIAR NOVO USUÁRIO NO BANCO
    # ========================================================================
    # ATENÇÃO: SQLAlchemy NÃO mapeia automaticamente campos do schema!
    # Cada campo do schema precisa ser EXPLICITAMENTE mapeado aqui.
    #
    # MAPEAMENTO DE CAMPOS:
    # - nome = user.name (nome do schema → nome no banco)
    # - email = user.email (email validado pelo Pydantic)
    # - senha_hash = hashed_password (senha já hasheada com bcrypt)
    # - weight = user.weight (peso validado entre 20kg e 500kg)
    # - height = user.height (altura validada entre 0.5m e 3.0m)
    # - birth_date = user.birth_date (data de nascimento)
    # - gender = user.gender (gênero validado: M, F ou O)
    #
    # REGRA DE OURO: Se está no schema, deve estar aqui!
    # ========================================================================
    new_user = models.User(
        nome=user.name,              # Nome completo do usuário
        email=user.email,            # Email único (validado como EmailStr)
        senha_hash=hashed_password,  # Hash bcrypt da senha (nunca salvar senha em texto plano)
        weight=user.weight,          # Peso em kg (usado para cálculos de treino)
        height=user.height,          # Altura em metros (usado para cálculo de IMC)
        birth_date=user.birth_date,  # Data de nascimento (formato string, ex: "1990-05-15")
        gender=user.gender           # Gênero (M/F/O) - para personalização de treinos
    )
    
    # ========================================================================
    # PASSO 4: SALVAR NO BANCO DE DADOS
    # ========================================================================
    # db.add() adiciona o objeto à sessão (ainda não salva no banco)
    db.add(new_user)
    
    # db.commit() executa INSERT no banco e confirma a transação
    # SQL gerado: INSERT INTO users (id, nome, email, senha_hash, ...) VALUES (...)
    db.commit()
    
    # db.refresh() atualiza o objeto com dados do banco (ex: id gerado automaticamente)
    # Isso garante que new_user.id tenha o UUID gerado pelo banco
    db.refresh(new_user)
    
    # ========================================================================
    # PASSO 5: RETORNAR DADOS PÚBLICOS DO USUÁRIO
    # ========================================================================
    # SEGURANÇA: NUNCA retornar senha_hash ou outros dados sensíveis!
    # Retorna apenas id, name e email (dados públicos)
    return {
        "id": str(new_user.id),  # Converte UUID para string
        "name": new_user.nome,
        "email": new_user.email
    }
