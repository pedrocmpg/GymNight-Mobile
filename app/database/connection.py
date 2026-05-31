# ============================================================================
# MÓDULO DE CONEXÃO COM BANCO DE DADOS
# ============================================================================
# Este módulo centraliza toda a configuração do SQLAlchemy para conexão
# com o PostgreSQL, seguindo o princípio de Single Responsibility.
#
# COMPONENTES:
# - engine: Motor de conexão com o banco (pool de conexões)
# - SessionLocal: Fábrica de sessões para transações
# - Base: Classe base para todos os modelos ORM
# - get_db: Dependency injection para rotas FastAPI
# ============================================================================

from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.core.config import DATABASE_URL

# ============================================================================
# ENGINE: Motor de conexão com o banco de dados
# ============================================================================
# O engine é responsável por gerenciar o pool de conexões com o PostgreSQL.
# Ele mantém conexões abertas e reutiliza para melhorar performance.
#
# PARÂMETROS:
# - DATABASE_URL: String de conexão importada do módulo de configuração
#
# POOL DE CONEXÕES:
# - Por padrão, SQLAlchemy mantém 5 conexões abertas (pool_size=5)
# - Quando uma rota precisa do banco, pega uma conexão do pool
# - Após usar, devolve a conexão para o pool (não fecha)
# - Isso evita overhead de abrir/fechar conexões a cada requisição
# ============================================================================
engine = create_engine(DATABASE_URL)

# ============================================================================
# SESSIONLOCAL: Fábrica de sessões do banco de dados
# ============================================================================
# SessionLocal é uma classe (não uma instância) que cria sessões do banco.
# Cada sessão representa uma transação isolada com o banco de dados.
#
# PARÂMETROS:
# - autocommit=False: Transações precisam de commit() explícito (mais seguro)
# - autoflush=False: Não envia dados automaticamente antes de queries (mais controle)
# - bind=engine: Vincula esta fábrica ao engine criado acima
#
# USO:
# db = SessionLocal()  # Cria uma nova sessão
# db.query(User).all()  # Usa a sessão para queries
# db.commit()  # Salva mudanças no banco
# db.close()  # Fecha a sessão (devolve conexão ao pool)
# ============================================================================
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# ============================================================================
# BASE: Classe base para modelos ORM
# ============================================================================
# Todos os modelos SQLAlchemy (User, Workout, Exercise) herdam desta classe.
# Ela fornece funcionalidades de mapeamento objeto-relacional (ORM).
#
# FUNCIONALIDADES:
# - Mapeia classes Python para tabelas do banco
# - Converte atributos Python em colunas SQL
# - Permite criar tabelas automaticamente: Base.metadata.create_all(engine)
# - Gerencia relacionamentos entre tabelas (ForeignKey, relationship)
# ============================================================================
Base = declarative_base()


def get_db():
    """
    Dependency Injection para fornecer sessão do banco nas rotas FastAPI.
    
    FUNCIONAMENTO:
    --------------
    Esta função é um generator que cria uma sessão do banco, fornece para
    a rota, e garante que a sessão seja fechada após o uso (mesmo se houver erro).
    
    FLUXO DE EXECUÇÃO:
    ------------------
    1. FastAPI chama get_db() quando uma rota precisa do banco
    2. SessionLocal() cria uma nova sessão
    3. yield db fornece a sessão para a rota (pausa a execução aqui)
    4. Rota usa a sessão para queries (db.query(), db.add(), db.commit())
    5. Após a rota terminar (sucesso ou erro), execução retorna aqui
    6. finally: db.close() garante que a sessão seja fechada
    7. Conexão é devolvida ao pool (não é destruída)
    
    USO EM ROTAS:
    -------------
    @app.post("/users")
    def create_user(user: UserCreate, db: Session = Depends(get_db)):
        # db é injetado automaticamente pelo FastAPI
        new_user = User(nome=user.name, email=user.email)
        db.add(new_user)
        db.commit()
        return {"id": new_user.id}
    
    VANTAGENS:
    ----------
    - Não precisa lembrar de fechar a sessão manualmente (finally garante)
    - Código mais limpo (sem try/finally em cada rota)
    - Testável (pode mockar get_db em testes unitários)
    - Seguro (sessão sempre fecha, mesmo se houver exceção)
    
    Yields:
        Session: Sessão do SQLAlchemy pronta para uso
    
    Nota:
        Esta função usa yield em vez de return para garantir cleanup.
        O código após yield sempre executa, mesmo se a rota lançar exceção.
    """
    # Cria uma nova sessão do banco de dados
    db = SessionLocal()
    
    try:
        # Fornece a sessão para a rota (pausa aqui até a rota terminar)
        yield db
    finally:
        # Garante que a sessão seja fechada após o uso
        # Isso acontece SEMPRE, mesmo se houver erro na rota
        # A conexão é devolvida ao pool (não é destruída)
        db.close()
