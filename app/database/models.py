# ============================================================================
# MODELOS DO BANCO DE DADOS (ORM)
# ============================================================================
# Este módulo define as tabelas do banco usando SQLAlchemy ORM.
# Cada classe representa uma tabela, cada atributo representa uma coluna.
#
# TABELAS:
# - User: Usuários do aplicativo (cadastro, login, perfil)
# - Workout: Treinos criados pelos usuários
# - Exercise: Exercícios dentro de cada treino
# ============================================================================

from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
from app.database.connection import Base


class User(Base):
    """
    Modelo de usuário do aplicativo GymNight.
    
    CAMPOS:
    -------
    - id: Identificador único (UUID v4) - chave primária
    - nome: Nome completo do usuário
    - email: Email único para login (indexado para busca rápida)
    - senha_hash: Hash bcrypt da senha (NUNCA armazenar senha em texto plano)
    - weight: Peso do usuário em kg (usado para cálculos de treino)
    - height: Altura do usuário em metros (usado para cálculo de IMC)
    - birth_date: Data de nascimento (formato string, ex: "1990-05-15")
    - gender: Gênero do usuário ('M', 'F' ou 'O') - para personalização de treinos
    
    RELACIONAMENTOS:
    ----------------
    - workouts: Lista de treinos criados por este usuário (one-to-many)
    
    ÍNDICES:
    --------
    - id: Índice automático (chave primária)
    - email: Índice manual (index=True) para busca rápida no login
    
    CONSTRAINTS:
    ------------
    - email: UNIQUE (não permite emails duplicados)
    - Todos os campos: NOT NULL (obrigatórios)
    """
    __tablename__ = "users"
    
    # Chave primária: UUID v4 (ex: "123e4567-e89b-12d3-a456-426614174000")
    # UUID é melhor que INT auto-increment para APIs (não expõe quantidade de usuários)
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    
    # Nome completo do usuário (ex: "João Silva")
    nome = Column(String, nullable=False)
    
    # Email único para login (ex: "joao@gmail.com")
    # unique=True cria constraint UNIQUE no banco
    # index=True cria índice para busca rápida (usado no login)
    email = Column(String, unique=True, nullable=False, index=True)
    
    # Hash bcrypt da senha (ex: "$2b$12$LQv3c1yqBWVHxkd0LHAkCO...")
    # NUNCA armazenar senha em texto plano!
    senha_hash = Column(String, nullable=False)
    
    # Peso do usuário em kg (ex: 75.5)
    # Usado para cálculos de carga de treino e métricas
    weight = Column(Float, nullable=False)
    
    # Altura do usuário em metros (ex: 1.75)
    # Usado para cálculo de IMC e estatísticas
    height = Column(Float, nullable=False)
    
    # Data de nascimento em formato string (ex: "1990-05-15")
    # Usado para validações de idade e estatísticas
    birth_date = Column(String, nullable=False)
    
    # Gênero do usuário para personalização de treinos e métricas biológicas
    # Valores aceitos: 'M' (masculino), 'F' (feminino), 'O' (outro)
    # String(1) limita a 1 caractere no banco
    gender = Column(String(1), nullable=False)
    
    # Relacionamento one-to-many: Um usuário tem muitos treinos
    # back_populates cria referência bidirecional (User.workouts e Workout.user)
    # cascade="all, delete-orphan" deleta treinos quando usuário for deletado
    workouts = relationship("Workout", back_populates="user")


class Workout(Base):
    """
    Modelo de treino criado pelo usuário.
    
    CAMPOS:
    -------
    - id: Identificador único (UUID v4) - chave primária
    - user_id: ID do usuário dono deste treino (chave estrangeira)
    - nome_treino: Nome do treino (ex: "Treino A - Peito e Tríceps")
    - data_criacao: Data/hora de criação do treino (UTC)
    
    RELACIONAMENTOS:
    ----------------
    - user: Usuário dono deste treino (many-to-one)
    - exercises: Lista de exercícios deste treino (one-to-many)
    """
    __tablename__ = "workouts"
    
    # Chave primária: UUID v4
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    
    # Chave estrangeira: ID do usuário dono deste treino
    # ForeignKey("users.id") cria constraint no banco
    # nullable=False garante que todo treino tem um dono
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    
    # Nome do treino (ex: "Treino A - Peito e Tríceps")
    nome_treino = Column(String, nullable=False)
    
    # Data/hora de criação do treino em UTC
    # default=datetime.utcnow define automaticamente ao criar
    data_criacao = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Relacionamento many-to-one: Muitos treinos pertencem a um usuário
    user = relationship("User", back_populates="workouts")
    
    # Relacionamento one-to-many: Um treino tem muitos exercícios
    exercises = relationship("Exercise", back_populates="workout")


class Exercise(Base):
    """
    Modelo de exercício dentro de um treino.
    
    CAMPOS:
    -------
    - id: Identificador único (UUID v4) - chave primária
    - workout_id: ID do treino que contém este exercício (chave estrangeira)
    - nome_exercicio: Nome do exercício (ex: "Supino Reto")
    - series: Número de séries (ex: 4)
    - repeticoes: Número de repetições por série (ex: 12)
    - peso: Peso usado em kg (opcional, ex: 80)
    
    RELACIONAMENTOS:
    ----------------
    - workout: Treino que contém este exercício (many-to-one)
    """
    __tablename__ = "exercises"
    
    # Chave primária: UUID v4
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    
    # Chave estrangeira: ID do treino que contém este exercício
    workout_id = Column(UUID(as_uuid=True), ForeignKey("workouts.id"), nullable=False)
    
    # Nome do exercício (ex: "Supino Reto", "Agachamento Livre")
    nome_exercicio = Column(String, nullable=False)
    
    # Número de séries (ex: 4)
    series = Column(Integer, nullable=False)
    
    # Número de repetições por série (ex: 12)
    repeticoes = Column(Integer, nullable=False)
    
    # Peso usado em kg (opcional, pode ser None para exercícios de peso corporal)
    # nullable=True permite NULL no banco
    peso = Column(Integer, nullable=True)
    
    # Relacionamento many-to-one: Muitos exercícios pertencem a um treino
    workout = relationship("Workout", back_populates="exercises")
