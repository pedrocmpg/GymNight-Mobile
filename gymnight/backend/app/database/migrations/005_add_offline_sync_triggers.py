"""Add offline sync triggers (tombstone infrastructure)

Revision ID: 005
Revises: 004
Description:
    Move toda a infraestrutura de triggers de sincronismo offline-first do
    sistema de event listeners do SQLAlchemy (after_create) para o pipeline
    determinístico do Alembic.

    O que esta migração faz (upgrade):
    1. Garante que a tabela deleted_records existe com o schema correto.
    2. Cria (ou substitui) a função PL/pgSQL create_tombstone_on_delete().
    3. Acopla triggers AFTER DELETE FOR EACH ROW nas 4 tabelas sincronizáveis
       do WatermelonDB usando a estratégia DROP + CREATE (idempotente em
       qualquer versão do PostgreSQL):
         - workouts          → trg_tombstone_workouts
         - workout_sessions  → trg_tombstone_workout_sessions
         - logged_sets       → trg_tombstone_logged_sets
         - exercises         → trg_tombstone_exercises

    O que o downgrade faz:
    - Remove os 4 triggers criados (DROP TRIGGER IF EXISTS).
    - Remove a função create_tombstone_on_delete() (DROP FUNCTION IF EXISTS).
    - NÃO remove a tabela deleted_records — os tombstones históricos têm
      valor de auditoria e não podem ser recriados retroativamente.

    NOTA SINTÁTICA POSTGRESQL:
    O PostgreSQL NÃO suporta "CREATE OR REPLACE TRIGGER". Para garantir
    idempotência, cada trigger é precedido por "DROP TRIGGER IF EXISTS"
    antes do "CREATE TRIGGER". A função de trigger pode usar
    "CREATE OR REPLACE FUNCTION" normalmente.

Requirements: offline-first sync protocol (WatermelonDB)
"""

from alembic import op


# revision identifiers, used by Alembic
revision = "005"
down_revision = "004"
branch_labels = None
depends_on = None


# ============================================================================
# SQL: Garante que a tabela deleted_records existe
# ============================================================================
# Schema bate 1:1 com o modelo ORM DeletedRecord em app/database/models/sync.py:
#
#   id          String(36)   PK      → VARCHAR(36)  NOT NULL
#   table_name  String(255)  NOT NULL → VARCHAR(255) NOT NULL
#   record_id   String(36)   NOT NULL → VARCHAR(36)  NOT NULL
#   user_id     String(36)   NULL     → VARCHAR(36)  NULL
#   deleted_at  BigInteger   NOT NULL → BIGINT       NOT NULL
#
# Indexes espelham os Index() declarados no modelo ORM:
#   idx_deleted_records_deleted_at       → deleted_at
#   idx_deleted_records_table_name       → table_name
#   idx_deleted_records_user_deleted_at  → (user_id, deleted_at) composite
#
# CREATE TABLE IF NOT EXISTS e CREATE INDEX IF NOT EXISTS garantem
# idempotência — não falham se já existirem.
_CREATE_DELETED_RECORDS_SQL = """
CREATE TABLE IF NOT EXISTS deleted_records (
    id         VARCHAR(36)  NOT NULL,
    table_name VARCHAR(255) NOT NULL,
    record_id  VARCHAR(36)  NOT NULL,
    user_id    VARCHAR(36)  NULL,
    deleted_at BIGINT       NOT NULL,
    CONSTRAINT pk_deleted_records PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_deleted_records_deleted_at
    ON deleted_records (deleted_at);

CREATE INDEX IF NOT EXISTS idx_deleted_records_table_name
    ON deleted_records (table_name);

CREATE INDEX IF NOT EXISTS idx_deleted_records_user_deleted_at
    ON deleted_records (user_id, deleted_at);
"""


# ============================================================================
# SQL: Função PL/pgSQL que cria tombstones automaticamente nos DELETEs
# ============================================================================
# CREATE OR REPLACE FUNCTION é suportado pelo PostgreSQL e garante
# idempotência — pode ser reexecutada sem erro.
#
# Lógica de extração de user_id por tabela:
#   - 'exercises'  → NULL (catálogo compartilhado, sem dono por usuário)
#   - demais       → OLD.user_id (extraído via EXECUTE dinâmico com fallback NULL)
#
# Nota: a tabela 'users' não está no escopo desta migration. Caso seja
# necessário no futuro, adicionar o branch IF TG_TABLE_NAME = 'users'.
#
# deleted_at: floor(EXTRACT(EPOCH FROM NOW()) * 1000)::bigint
#   → Unix milissegundos, consistente com todos os campos *_at do sistema.
_CREATE_TOMBSTONE_FUNCTION_SQL = """
CREATE OR REPLACE FUNCTION create_tombstone_on_delete()
RETURNS TRIGGER AS $$
DECLARE
    v_user_id TEXT;
BEGIN
    IF TG_TABLE_NAME = 'exercises' THEN
        -- Exercises são catálogo compartilhado: sem user_id
        v_user_id := NULL;
    ELSE
        -- workouts, workout_sessions, logged_sets possuem coluna user_id
        BEGIN
            EXECUTE format('SELECT ($1).user_id::text') USING OLD INTO v_user_id;
        EXCEPTION WHEN OTHERS THEN
            v_user_id := NULL;
        END;
    END IF;

    INSERT INTO deleted_records (id, table_name, record_id, user_id, deleted_at)
    VALUES (
        gen_random_uuid()::text,
        TG_TABLE_NAME,
        OLD.id,
        v_user_id,
        floor(EXTRACT(EPOCH FROM NOW()) * 1000)::bigint
    );

    RETURN OLD;
END;
$$ LANGUAGE plpgsql;
"""


# ============================================================================
# SQL: DROP + CREATE para cada trigger (padrão idempotente no PostgreSQL)
# ============================================================================
# O PostgreSQL NÃO suporta "CREATE OR REPLACE TRIGGER".
# A estratégia correta é: DROP TRIGGER IF EXISTS seguido de CREATE TRIGGER.
# Isso garante idempotência em qualquer versão do PostgreSQL (incluindo
# versões anteriores à 14 que até hoje não suportam OR REPLACE em triggers).
#
# AFTER DELETE: só cria tombstone após a deleção ser confirmada pelo banco,
# evitando tombstones fantasmas caso a transação faça rollback.
#
# FOR EACH ROW: necessário para capturar OLD.id de cada linha deletada
# individualmente — indispensável para deleções em cascata.

# --- workouts ---------------------------------------------------------------
_DROP_TRIGGER_WORKOUTS = (
    "DROP TRIGGER IF EXISTS trg_tombstone_workouts ON workouts;"
)
_CREATE_TRIGGER_WORKOUTS = """
CREATE TRIGGER trg_tombstone_workouts
AFTER DELETE ON workouts
FOR EACH ROW
EXECUTE FUNCTION create_tombstone_on_delete();
"""

# --- workout_sessions --------------------------------------------------------
_DROP_TRIGGER_WORKOUT_SESSIONS = (
    "DROP TRIGGER IF EXISTS trg_tombstone_workout_sessions ON workout_sessions;"
)
_CREATE_TRIGGER_WORKOUT_SESSIONS = """
CREATE TRIGGER trg_tombstone_workout_sessions
AFTER DELETE ON workout_sessions
FOR EACH ROW
EXECUTE FUNCTION create_tombstone_on_delete();
"""

# --- logged_sets -------------------------------------------------------------
_DROP_TRIGGER_LOGGED_SETS = (
    "DROP TRIGGER IF EXISTS trg_tombstone_logged_sets ON logged_sets;"
)
_CREATE_TRIGGER_LOGGED_SETS = """
CREATE TRIGGER trg_tombstone_logged_sets
AFTER DELETE ON logged_sets
FOR EACH ROW
EXECUTE FUNCTION create_tombstone_on_delete();
"""

# --- exercises ---------------------------------------------------------------
# Embora exercises usem RESTRICT em suas FKs (impedindo deleção se referenciadas),
# exercises SEM referências podem ser deletadas. O tombstone garante que clientes
# offline removam o registro do catálogo local durante o próximo sync.
_DROP_TRIGGER_EXERCISES = (
    "DROP TRIGGER IF EXISTS trg_tombstone_exercises ON exercises;"
)
_CREATE_TRIGGER_EXERCISES = """
CREATE TRIGGER trg_tombstone_exercises
AFTER DELETE ON exercises
FOR EACH ROW
EXECUTE FUNCTION create_tombstone_on_delete();
"""


# ============================================================================
# UPGRADE
# ============================================================================

def upgrade():
    """
    Aplica toda a infraestrutura de tombstone/triggers no banco de dados.

    Ordem de execução (dependências respeitadas):
    1. deleted_records + indexes  — a função referencia esta tabela no INSERT
    2. create_tombstone_on_delete() — os triggers referenciam esta função
    3. DROP + CREATE trg_tombstone_workouts
    4. DROP + CREATE trg_tombstone_workout_sessions
    5. DROP + CREATE trg_tombstone_logged_sets
    6. DROP + CREATE trg_tombstone_exercises
    """
    # Passo 1: Garante a tabela deleted_records e seus indexes
    op.execute(_CREATE_DELETED_RECORDS_SQL)

    # Passo 2: Cria (ou substitui) a função PL/pgSQL de tombstone
    op.execute(_CREATE_TOMBSTONE_FUNCTION_SQL)

    # Passos 3–6: DROP + CREATE para cada trigger (idempotente no PostgreSQL)
    op.execute(_DROP_TRIGGER_WORKOUTS)
    op.execute(_CREATE_TRIGGER_WORKOUTS)

    op.execute(_DROP_TRIGGER_WORKOUT_SESSIONS)
    op.execute(_CREATE_TRIGGER_WORKOUT_SESSIONS)

    op.execute(_DROP_TRIGGER_LOGGED_SETS)
    op.execute(_CREATE_TRIGGER_LOGGED_SETS)

    op.execute(_DROP_TRIGGER_EXERCISES)
    op.execute(_CREATE_TRIGGER_EXERCISES)


# ============================================================================
# DOWNGRADE
# ============================================================================

def downgrade():
    """
    Remove os 4 triggers e a função de tombstone.

    A tabela deleted_records NÃO é removida: os tombstones históricos não
    podem ser recriados retroativamente e têm valor de auditoria.

    Ordem de remoção (inverso das dependências):
    1. Triggers primeiro (referenciam a função; devem ser removidos antes)
    2. Função depois (após todos os triggers que a referenciam serem removidos)
    """
    # Remove triggers em ordem inversa de criação
    op.execute("DROP TRIGGER IF EXISTS trg_tombstone_exercises ON exercises;")
    op.execute("DROP TRIGGER IF EXISTS trg_tombstone_logged_sets ON logged_sets;")
    op.execute(
        "DROP TRIGGER IF EXISTS trg_tombstone_workout_sessions ON workout_sessions;"
    )
    op.execute("DROP TRIGGER IF EXISTS trg_tombstone_workouts ON workouts;")

    # Remove a função após os triggers que a referenciam serem removidos
    op.execute("DROP FUNCTION IF EXISTS create_tombstone_on_delete();")

    # deleted_records NÃO é removida — preserva tombstones históricos.
