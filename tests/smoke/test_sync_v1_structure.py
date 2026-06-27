"""
Smoke tests: estrutura de diretórios e ausência de padrões legados no Sync Router v1.

Verifica:
9.1 — __init__.py existem em todos os níveis do pacote app/api/v1/
9.2 — sync_router é importável e tem prefixo "/sync"
9.3 — sync.py não usa padrões incorretos (async def, AsyncSession, bug legado created:[])
9.4 — main.py registra o sync_router com prefixo "/api/v1"

Requirements: 1.1, 1.2, 1.3, 1.4, 4.3, 11.2
"""

import os
from pathlib import Path

# ---------------------------------------------------------------------------
# Constantes de caminhos
# ---------------------------------------------------------------------------

PROJECT_ROOT = Path(__file__).resolve().parents[2]
SYNC_FILE = PROJECT_ROOT / "app" / "api" / "v1" / "endpoints" / "sync.py"
MAIN_FILE = PROJECT_ROOT / "app" / "main.py"


# ---------------------------------------------------------------------------
# 9.1 Smoke: __init__.py existem em todos os níveis
# Validates: Requirements 1.2
# ---------------------------------------------------------------------------

def test_init_py_api_level_exists():
    """
    Requirement 1.2 — app/api/__init__.py deve existir para tornar o pacote importável.
    """
    init_file = PROJECT_ROOT / "app" / "api" / "__init__.py"
    assert init_file.exists(), (
        f"Arquivo não encontrado: {init_file}\n"
        "O pacote app/api deve ter um __init__.py para ser importável."
    )


def test_init_py_v1_level_exists():
    """
    Requirement 1.2 — app/api/v1/__init__.py deve existir para tornar o pacote importável.
    """
    init_file = PROJECT_ROOT / "app" / "api" / "v1" / "__init__.py"
    assert init_file.exists(), (
        f"Arquivo não encontrado: {init_file}\n"
        "O pacote app/api/v1 deve ter um __init__.py para ser importável."
    )


def test_init_py_endpoints_level_exists():
    """
    Requirement 1.2 — app/api/v1/endpoints/__init__.py deve existir para tornar o pacote importável.
    """
    init_file = PROJECT_ROOT / "app" / "api" / "v1" / "endpoints" / "__init__.py"
    assert init_file.exists(), (
        f"Arquivo não encontrado: {init_file}\n"
        "O pacote app/api/v1/endpoints deve ter um __init__.py para ser importável."
    )


# ---------------------------------------------------------------------------
# 9.2 Smoke: sync_router importável e com prefixo correto
# Validates: Requirements 1.1, 1.3, 1.4
# ---------------------------------------------------------------------------

def test_sync_router_importable_with_correct_prefix():
    """
    Requirements 1.1, 1.3, 1.4 — sync_router deve ser importável de
    app.api.v1.endpoints.sync e ter prefix="/sync".
    """
    # Set env vars required by app modules before importing
    os.environ.setdefault("SUPABASE_URL", "http://test-placeholder")
    os.environ.setdefault("SUPABASE_JWT_SECRET", "test-secret-for-smoke-tests-xx")
    os.environ.setdefault("DATABASE_URL", "postgresql://localhost/test")

    from app.api.v1.endpoints.sync import sync_router  # noqa: PLC0415

    assert sync_router.prefix == "/sync", (
        f"sync_router.prefix esperado: '/sync', obtido: {sync_router.prefix!r}\n"
        "O router deve ser instanciado com APIRouter(prefix='/sync', ...)."
    )


# ---------------------------------------------------------------------------
# 9.3 Smoke: ausência de padrões incorretos de protocolo
# Validates: Requirements 4.3, 11.2
# ---------------------------------------------------------------------------

def test_sync_file_does_not_use_async_def():
    """
    Requirement 11.2 — sync.py NÃO deve usar 'async def' (deve ser síncrono).
    """
    source = SYNC_FILE.read_text(encoding="utf-8")
    assert "async def" not in source, (
        f"'{SYNC_FILE}' contém 'async def'.\n"
        "Requirement 11.2: o Sync_Router deve usar SQLAlchemy síncrono, "
        "sem construções assíncronas."
    )


def test_sync_file_does_not_use_async_session():
    """
    Requirement 11.2 — sync.py NÃO deve importar ou usar AsyncSession.
    """
    source = SYNC_FILE.read_text(encoding="utf-8")
    assert "AsyncSession" not in source, (
        f"'{SYNC_FILE}' contém 'AsyncSession'.\n"
        "Requirement 11.2: o Sync_Router deve usar Session síncrona via get_db, "
        "nunca AsyncSession."
    )


def test_sync_file_does_not_contain_legacy_created_empty_updated_populated_pattern():
    """
    Requirements 4.3 — sync.py NÃO deve conter o padrão legado onde 'created'
    era sempre uma lista vazia enquanto todo o conteúdo era colocado em 'updated'.

    O bug legado manifestava-se como:
        "created": []
        "updated": [<todos os registros>]

    O código correto usa _split_created_updated() para separar registros em
    created/updated com base em created_at vs last_pulled_at.
    """
    source = SYNC_FILE.read_text(encoding="utf-8")

    # O padrão legado colocava tudo em "updated" com "created" sempre vazio.
    # Verificamos que o arquivo não contém uma construção onde "created" é
    # hard-coded como lista vazia ao lado de um campo "updated" populado,
    # ou seja, a atribuição estática `"created": []` dentro do bloco de montagem
    # do `changes` (que no código correto usa variáveis *_created, *_updated).
    #
    # No código correto, os valores de "created" e "updated" são variáveis
    # derivadas de _split_created_updated(), nunca listas literais [] embutidas
    # diretamente na construção do dict `changes`.
    #
    # Estratégia: verificar que a função _split_created_updated está presente
    # (prova de que a separação correta é usada) e que o arquivo usa as variáveis
    # *_created / *_updated em vez de literais `[]` para popular o changes dict.
    assert "_split_created_updated" in source, (
        f"'{SYNC_FILE}' não contém '_split_created_updated'.\n"
        "Requirement 4.3: o Pull deve separar registros em created/updated usando "
        "_split_created_updated(), não retornar 'created: []' com tudo em 'updated'."
    )

    # Verificação adicional: os campos "created" e "updated" no dict changes
    # devem referenciar variáveis *_created/*_updated, não listas vazias literais.
    # O padrão legado usaria `"created": [], "updated": <lista de rows>`.
    # Verificamos que nenhuma linha contém exatamente `"created": []` seguida de
    # `"updated":` na montagem do changes dict (indicativo do bug).
    lines = source.splitlines()
    for i, line in enumerate(lines):
        stripped = line.strip()
        # Detecta o padrão literal `"created": []` que seria o bug legado
        # dentro de um bloco de construção de changes (não em definições de classe/schema)
        if stripped == '"created": [],' or stripped == '"created": []':
            # Verificar contexto: se as linhas próximas contêm "updated": com dados
            # e não estamos dentro de uma definição de schema Pydantic
            context_window = lines[max(0, i - 5):min(len(lines), i + 5)]
            context_str = "\n".join(context_window)
            # Permitido apenas em definições de BaseModel (é o default do campo)
            if "BaseModel" not in context_str and "class " not in context_str:
                assert False, (
                    f"'{SYNC_FILE}' linha {i + 1}: padrão legado detectado — "
                    f"'\"created\": []' encontrado fora de definição de schema.\n"
                    f"Contexto:\n{context_str}\n\n"
                    "Requirement 4.3: created e updated devem ser populados via "
                    "_split_created_updated(), nunca como listas vazias literais no "
                    "bloco de montagem do changes dict."
                )


# ---------------------------------------------------------------------------
# 9.4 Smoke: endpoint registrado em main.py com prefixo /api/v1
# Validates: Requirements 1.3
# ---------------------------------------------------------------------------

def test_main_py_includes_sync_router_with_api_v1_prefix():
    """
    Requirement 1.3 — app/main.py deve registrar sync_router com prefix='/api/v1',
    tornando os endpoints acessíveis em GET /api/v1/sync/pull e POST /api/v1/sync/push.
    """
    source = MAIN_FILE.read_text(encoding="utf-8")

    assert "include_router(sync_router" in source, (
        f"'{MAIN_FILE}' não contém 'include_router(sync_router'.\n"
        "Requirement 1.3: main.py deve registrar o sync_router via app.include_router()."
    )

    assert 'prefix="/api/v1"' in source, (
        f"'{MAIN_FILE}' não contém 'prefix=\"/api/v1\"'.\n"
        "Requirement 1.3: o sync_router deve ser registrado com prefix='/api/v1' "
        "para que os endpoints fiquem acessíveis em /api/v1/sync/pull e /api/v1/sync/push."
    )
