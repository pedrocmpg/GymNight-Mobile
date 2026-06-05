# ============================================================================
# MODELS PACKAGE: Centralized ORM model exports for GymNight backend
# ============================================================================
"""
Pacote de modelos ORM do GymNight - Offline-First com WatermelonDB Sync.

Este módulo agrega e exporta todos os modelos de forma centralizada,
garantindo retrocompatibilidade total com os imports existentes:

    from app.database.models import User, Workout, LoggedSet

ARQUITETURA:
------------
- Cada modelo está em seu próprio arquivo modular
- Todos importam Base de app.database.connection (instância única)
- Relacionamentos usam strings para evitar imports circulares
- Triggers e validadores preservados 100%

ESTRUTURA DE MÓDULOS:
---------------------
- utils.py: Funções utilitárias (current_timestamp_ms)
- user.py: Modelo User
- exercise.py: Modelo Exercise
- workout.py: Modelos Workout e WorkoutExercise
- history.py: Modelos WorkoutSession e LoggedSet (com validador Epley)
- sync.py: Modelo DeletedRecord + Triggers PostgreSQL

RETROCOMPATIBILIDADE:
---------------------
Imports antigos continuam funcionando sem modificações:
    from app.database.models import User, Workout, LoggedSet
    from app.database.models import DeletedRecord, CREATE_USERS_TRIGGER_SQL

SYNC PROTOCOL:
--------------
- Base.metadata contém todos os modelos (descoberta automática)
- Triggers PostgreSQL anexados via event.listen (automático)
- DeletedRecord rastreia deleções para sincronização offline
"""

# ============================================================================
# IMPORTAÇÃO CENTRALIZADA: Modelos segregados em módulos isolados
# ============================================================================

# Função utilitária de timestamp (usada por todos os modelos)
from .utils import current_timestamp_ms

# Modelos core de usuário e exercícios
from .user import User
from .exercise import Exercise

# Modelos de planejamento de treino
from .workout import Workout, WorkoutExercise

# Modelos de histórico de treino (com validador Epley)
from .history import WorkoutSession, LoggedSet

# Infraestrutura de sincronização (DeletedRecord + Triggers PostgreSQL)
from .sync import (
    DeletedRecord,
    # Strings DDL de Triggers SQL (para Alembic migrations)
    CREATE_TOMBSTONE_FUNCTION_SQL,
    CREATE_USERS_TRIGGER_SQL,
    CREATE_WORKOUTS_TRIGGER_SQL,
    CREATE_WORKOUT_EXERCISES_TRIGGER_SQL,
    CREATE_WORKOUT_SESSIONS_TRIGGER_SQL,
    CREATE_LOGGED_SETS_TRIGGER_SQL,
)

# ============================================================================
# EXPORTAÇÃO PÚBLICA: Garante retrocompatibilidade dos imports
# ============================================================================

__all__ = [
    # Função utilitária
    "current_timestamp_ms",
    
    # Modelos ORM
    "User",
    "Exercise",
    "Workout",
    "WorkoutExercise",
    "WorkoutSession",
    "LoggedSet",
    "DeletedRecord",
    
    # Strings DDL de Triggers (para migrações Alembic)
    "CREATE_TOMBSTONE_FUNCTION_SQL",
    "CREATE_USERS_TRIGGER_SQL",
    "CREATE_WORKOUTS_TRIGGER_SQL",
    "CREATE_WORKOUT_EXERCISES_TRIGGER_SQL",
    "CREATE_WORKOUT_SESSIONS_TRIGGER_SQL",
    "CREATE_LOGGED_SETS_TRIGGER_SQL",
]
