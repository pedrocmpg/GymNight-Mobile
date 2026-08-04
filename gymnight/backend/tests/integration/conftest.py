"""
Integration test fixtures for GymNight backend.

Requirements: 13.2, 13.3, 13.4, 13.7

These fixtures require a real PostgreSQL instance.  Set TEST_DATABASE_URL to
a valid PostgreSQL connection string before running.  If the variable is absent
all integration tests are skipped immediately with a descriptive error.

Fixture design:
  - engine (session-scoped): creates the SQLAlchemy engine and runs
    `alembic upgrade head` exactly once before any test in the session.
  - db_transaction (autouse, function-scoped): opens a connection, begins a
    transaction, yields a Session bound to that connection, then rolls back
    after each test — guaranteeing full isolation between tests (Req 13.7).
"""

import os
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

# alembic.ini lives at gymnight/backend/alembic.ini — resolve relative to this
# file (not the current working directory) so `pytest` works the same whether
# invoked from `gymnight/backend/` or any other directory.
_ALEMBIC_INI = Path(__file__).resolve().parents[2] / "alembic.ini"

# ---------------------------------------------------------------------------
# Guard: abort the entire integration module if TEST_DATABASE_URL is not set
# (Requirement 13.3)
# ---------------------------------------------------------------------------

TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL")

if not TEST_DATABASE_URL:
    pytest.skip(
        "TEST_DATABASE_URL is not set — skipping all integration tests. "
        "Set TEST_DATABASE_URL to a PostgreSQL connection string "
        "(e.g. postgresql://user:pass@localhost:5432/gymnight_test) "
        "to run integration tests.",
        allow_module_level=True,
    )


# ---------------------------------------------------------------------------
# Session-scoped engine + Alembic migration
# (Requirements 13.2, 13.4)
# ---------------------------------------------------------------------------


@pytest.fixture(scope="session")
def engine():
    """
    Create a session-scoped SQLAlchemy engine and run Alembic migrations once.

    The fixture connects to the database specified by TEST_DATABASE_URL and
    runs `alembic upgrade head` so the schema is fully up-to-date before any
    test executes.  If the migration fails pytest aborts the session.
    """
    eng = create_engine(TEST_DATABASE_URL)

    # Run Alembic migrations against the test database (Req 13.4)
    alembic_cfg = Config(str(_ALEMBIC_INI))
    alembic_cfg.set_main_option("sqlalchemy.url", TEST_DATABASE_URL)
    command.upgrade(alembic_cfg, "head")

    yield eng

    eng.dispose()


# ---------------------------------------------------------------------------
# Per-test transaction rollback for test isolation
# (Requirement 13.7)
# ---------------------------------------------------------------------------


@pytest.fixture(autouse=True)
def db_transaction(engine):
    """
    Open a database connection, begin a transaction, yield a Session, and
    roll back after each test.

    The rollback ensures that every test starts with an identical, clean
    database state — no data written by one test can leak into another.

    Yields:
        sqlalchemy.orm.Session bound to the open (uncommitted) connection.
    """
    with engine.connect() as conn:
        trans = conn.begin()
        session = Session(bind=conn)
        yield session
        session.close()
        trans.rollback()
