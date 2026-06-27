# Design Document: Backend Fixes and Improvements

## Overview

This document covers the technical design for 14 requirements across 5 priority tiers in the GymNight FastAPI backend. The stack is **FastAPI + SQLAlchemy (sync) + PostgreSQL via Supabase + Alembic + PyJWT + Hypothesis**.

The core WatermelonDB sync engine and Supabase JWT authentication are already correct. The work here addresses: a missing-columns runtime crash in the User ORM model (P1), incomplete user profile CRUD endpoints (P2), infrastructure consolidation — legacy router removal, Alembic as the sole migration mechanism, and a proper health endpoint (P3), production readiness — rate limiting, tombstone cleanup, structured logging, and deploy configuration (P4), and real PostgreSQL integration tests in CI (P5).

### Current State Summary

| Area | Status |
|------|--------|
| User ORM model | Missing `weight`, `height`, `birth_date`, `gender` columns |
| `.env` in git | Present — credentials exposed |
| `GET /users/me`, `PATCH /users/me`, `DELETE /users/me` | Not implemented |
| Legacy `/sync/*` router | Still registered alongside `/api/v1/sync/*` |
| `Base.metadata.create_all()` | Called at startup — blocks Alembic as sole authority |
| `GET /health` | Only a root `/` health stub exists |
| Rate limiting | Not implemented |
| Tombstone cleanup | Not implemented |
| Structured logging + Correlation ID | Not implemented |
| Dockerfile / deploy config | Not present |
| Integration tests with real PostgreSQL | Not present |

---

## Architecture

### High-Level Component Map

```
┌──────────────────────────────────────────────────────────────────┐
│  FastAPI Application (app/main.py)                               │
│                                                                  │
│  Middleware Stack (innermost → outermost):                       │
│    1. CorrelationIDMiddleware  — injects/generates UUID          │
│    2. AccessLogMiddleware      — emits per-request JSON log      │
│    3. SlowAPI Limiter          — rate-limits sync endpoints      │
│                                                                  │
│  Routers:                                                        │
│    /users            → app/routers/users.py                     │
│    /api/v1/sync/*    → app/api/v1/endpoints/sync.py             │
│    /health           → app/routers/health.py  (new)             │
│    /admin/*          → app/routers/admin.py   (new)             │
└──────────────────┬───────────────────────────────────────────────┘
                   │ SQLAlchemy Session (sync)
                   ▼
┌──────────────────────────────────┐
│  PostgreSQL (Supabase)           │
│  Schema managed by Alembic only  │
│  Migrations: 001 → 006           │
└──────────────────────────────────┘
```

### Key Design Decisions

1. **Validation at the Pydantic schema layer, not the ORM layer.** Range checks for `weight`/`height` and format checks for `birth_date`/`gender` live in Pydantic validators on the request schemas. The ORM model stores validated data; the schema layer rejects invalid data with HTTP 422 before it reaches the database. SQLAlchemy `validates()` decorators are added as a secondary safety net.

2. **`create_all()` removed; Alembic is sole migration authority.** The `models.Base.metadata.create_all(bind=engine)` call in `app/main.py` will be deleted. All schema management goes through `alembic upgrade head`, which must be run before starting the server (CI pipeline, Dockerfile entrypoint).

3. **Middleware chain for cross-cutting concerns.** Correlation ID injection, access logging, and rate limiting are implemented as Starlette middleware rather than per-router dependencies. This ensures uniform coverage — including the health endpoint — without duplicating `Depends()` calls.

4. **SlowAPI for rate limiting.** SlowAPI wraps FastAPI's dependency injection system and integrates with Redis or in-memory storage. For a single-instance deploy, in-memory storage (default) suffices. The `RATE_LIMIT_ENABLED` env var gates the limiter so tests can disable it.

5. **Tombstone cleanup as an admin endpoint, not a background task.** Requirement 10.3 specifies `POST /admin/cleanup-tombstones`. This avoids the complexity of APScheduler or Celery while still allowing automated invocation from a cron job or CI pipeline. Admin auth uses a static `ADMIN_SECRET` env var checked against a `Bearer` token.

6. **structlog for structured logging.** `structlog` produces single-line JSON, supports context variables (correlation ID bound per-request), and integrates cleanly with Python's `logging` module. The correlation ID is bound to the structlog context at middleware level and is available throughout the request lifecycle.

---

## Components and Interfaces

### P1 — User ORM Model and Migration

**`app/database/models/user.py`** — add four columns:

```python
from sqlalchemy import Column, Float, String
from sqlalchemy.orm import validates

weight    = Column(Float,      nullable=True)
height    = Column(Float,      nullable=True)
birth_date = Column(String(10), nullable=True)
gender    = Column(String(10),  nullable=True)

@validates("weight")
def validate_weight(self, key, value):
    if value is not None and not (1.0 <= value <= 500.0):
        raise ValueError(f"weight must be between 1.0 and 500.0, got {value}")
    return value

@validates("height")
def validate_height(self, key, value):
    if value is not None and not (50.0 <= value <= 300.0):
        raise ValueError(f"height must be between 50.0 and 300.0, got {value}")
    return value

@validates("birth_date")
def validate_birth_date(self, key, value):
    import re
    if value is not None and not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
        raise ValueError(f"birth_date must be YYYY-MM-DD, got {value!r}")
    return value

@validates("gender")
def validate_gender(self, key, value):
    if value is not None and value not in {"male", "female", "other"}:
        raise ValueError(f"gender must be 'male', 'female', or 'other', got {value!r}")
    return value
```

**`app/database/migrations/alembic/versions/006_add_user_profile_fields.py`** — Alembic migration:

```
revision = "006"
down_revision = "005"

upgrade():
  op.add_column("users", Column("weight",     Float,      nullable=True))
  op.add_column("users", Column("height",     Float,      nullable=True))
  op.add_column("users", Column("birth_date", String(10), nullable=True))
  op.add_column("users", Column("gender",     String(10), nullable=True))

downgrade():
  op.drop_column("users", "gender")
  op.drop_column("users", "birth_date")
  op.drop_column("users", "height")
  op.drop_column("users", "weight")
```

The existing non-Alembic migration files (003–005) need to be converted into proper Alembic revisions under `alembic/versions/`. Revisions 001–005 cover the existing schema history; revision 006 adds the profile fields.

### P1 — Credential Security

**`.env.example`** (new file):
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_JWT_SECRET=your-jwt-secret-here
DATABASE_URL=postgresql://user:password@host:5432/dbname
```

**`app/core/config.py`** — add startup validation that raises a descriptive error listing missing variables when `Settings()` instantiation fails (pydantic-settings already does this; verify the error message names each missing variable).

### P2 — User Profile Endpoints

**`app/schemas/user.py`** — add Pydantic validators to `UserProfileCreate` and `UserProfileUpdate`:

```python
from pydantic import field_validator
from datetime import date

class UserProfileCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: Optional[str] = None
    weight: Optional[float] = None
    height: Optional[float] = None
    birth_date: Optional[str] = None
    gender: Optional[str] = None

    @field_validator("weight")
    @classmethod
    def validate_weight(cls, v):
        if v is not None and not (1.0 <= v <= 500.0):
            raise ValueError("weight must be between 1.0 and 500.0 kg")
        return v

    # ... similar validators for height, birth_date, gender
    # birth_date also checks: date.fromisoformat(v) <= date.today()
```

**`app/routers/users.py`** — add three new endpoints:

```
GET  /users/me    → get_my_profile()   → 200 | 401 | 404
PATCH /users/me   → update_my_profile() → 200 | 401 | 404 | 422
DELETE /users/me  → delete_my_account() → 204 | 401 | 404 | 500
```

All three use `current_user_id: str = Depends(get_current_user)`. The `user_id` is never accepted as a query or path parameter.

### P3 — Infrastructure Consolidation

**`app/main.py`** — remove `models.Base.metadata.create_all(bind=engine)` and the legacy router registration:

```python
# REMOVE these two lines:
models.Base.metadata.create_all(bind=engine)
app.include_router(sync.router)   # legacy /sync/*
```

**`app/routers/health.py`** (new file):

```python
router = APIRouter(tags=["health"])

@router.get("/health")
def health_check(db: Session = Depends(get_db)) -> dict:
    try:
        db.execute(text("SELECT 1"))
        return {"status": "ok", "database": "ok"}
    except Exception as exc:
        log.error("health_check_failed", error=str(exc),
                  correlation_id=get_correlation_id())
        raise HTTPException(503, detail={"status": "degraded",
                                         "database": "unreachable"})
```

No `Depends(get_current_user)` — the health endpoint is public.

### P4 — Production Readiness

**`app/middleware/correlation_id.py`** (new):

```python
class CorrelationIDMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        raw = request.headers.get("X-Correlation-ID", "")
        cid = raw if _is_uuid4(raw) else str(uuid4())
        structlog.contextvars.bind_contextvars(correlation_id=cid)
        response = await call_next(request)
        response.headers["X-Correlation-ID"] = cid
        return response
```

**`app/middleware/access_log.py`** (new):

```python
class AccessLogMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        t0 = time.monotonic()
        response = await call_next(request)
        latency_ms = round((time.monotonic() - t0) * 1000, 2)
        log.info("request", method=request.method, path=request.url.path,
                 status_code=response.status_code, latency_ms=latency_ms)
        return response
```

**`app/routers/admin.py`** (new):

```python
router = APIRouter(prefix="/admin", tags=["admin"])

def _require_admin(credentials: HTTPAuthorizationCredentials = Depends(bearer)):
    if credentials is None or credentials.credentials != settings.ADMIN_SECRET:
        raise HTTPException(401, detail="Admin authentication required")

@router.post("/cleanup-tombstones")
def cleanup_tombstones(
    _: None = Depends(_require_admin),
    db: Session = Depends(get_db),
) -> dict:
    retention = _get_retention_days()
    cutoff_ms = int((datetime.utcnow() - timedelta(days=retention)).timestamp() * 1000)
    try:
        n = db.query(DeletedRecord).filter(
            DeletedRecord.deleted_at < cutoff_ms
        ).delete(synchronize_session=False)
        db.commit()
        log.info("tombstone_cleanup", deleted_count=n,
                 timestamp=datetime.utcnow().isoformat())
        return {"deleted_count": n}
    except Exception as exc:
        db.rollback()
        log.error("tombstone_cleanup_failed", error=str(exc),
                  correlation_id=get_correlation_id())
        raise HTTPException(500, detail="Cleanup failed")
```

**SlowAPI rate limiter** added to `app/main.py`:

```python
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

def _get_rate_limit_key(request: Request) -> str:
    # Extract sub from JWT if present, else fall back to IP
    ...

limiter = Limiter(key_func=_get_rate_limit_key,
                  enabled=settings.RATE_LIMIT_ENABLED)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
```

Sync endpoints decorated with `@limiter.limit("60/minute")`.

### P5 — Integration Tests

**`tests/integration/`** (new directory):

```
tests/integration/
  conftest.py          # engine setup, alembic upgrade, transaction rollback fixture
  test_users_api.py    # POST, GET, PATCH /users integration tests
```

**`docker-compose.ci.yml`** (new):

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: gymnight_test
      POSTGRES_USER: test
      POSTGRES_PASSWORD: test
    ports:
      - "5433:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U test"]
      interval: 2s
      timeout: 5s
      retries: 10
```

**`.github/workflows/integration.yml`** (new) — CI pipeline:
1. Start postgres service
2. Wait for `pg_isready`
3. Run `alembic upgrade head` with `TEST_DATABASE_URL`
4. Run `pytest tests/integration/` with `TEST_DATABASE_URL`

---

## Data Models

### Updated `users` Table (after migration 006)

| Column | Type | Nullable | Constraint |
|--------|------|----------|------------|
| id | VARCHAR(36) | NOT NULL | PK, = JWT `sub` |
| name | VARCHAR(255) | NOT NULL | — |
| email | VARCHAR(255) | NOT NULL | UNIQUE, INDEX |
| weight | FLOAT | NULL | ORM: [1.0, 500.0] |
| height | FLOAT | NULL | ORM: [50.0, 300.0] |
| birth_date | VARCHAR(10) | NULL | ORM: `^\d{4}-\d{2}-\d{2}$`, ≤ today |
| gender | VARCHAR(10) | NULL | ORM: `{male, female, other}` |
| created_at | BIGINT | NOT NULL | auto: Unix ms |
| updated_at | BIGINT | NOT NULL | auto: Unix ms, onupdate |
| _status | VARCHAR(10) | NULL | WatermelonDB sync field |
| _changed | VARCHAR(500) | NULL | WatermelonDB sync field |

### `deleted_records` Table (unchanged)

| Column | Type | Nullable |
|--------|------|----------|
| id | VARCHAR(36) | NOT NULL PK |
| table_name | VARCHAR(255) | NOT NULL |
| record_id | VARCHAR(36) | NOT NULL |
| user_id | VARCHAR(36) | NULL |
| deleted_at | BIGINT | NOT NULL |

Indexes: `deleted_at`, `table_name`, `(user_id, deleted_at)`.

### Alembic Migration Chain (complete)

```
001_initial_schema           → creates users, exercises, workouts, …
002_xxx                      → (existing revision)
003_convert_datetime_bigint  → converts DateTime → BigInteger timestamps
004_remove_password_hash     → drops password_hash from users
005_add_offline_sync_triggers → deleted_records table + PG triggers
006_add_user_profile_fields  → adds weight, height, birth_date, gender to users
```

Note: revisions 001–003 currently exist as standalone Python scripts (not proper Alembic revisions). They need to be converted to Alembic version files so `alembic history` lists exactly 6 entries and `alembic heads` returns a single revision.

### New Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SUPABASE_URL` | Yes | — | Supabase project URL |
| `SUPABASE_JWT_SECRET` | Yes | — | JWT signing secret |
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `ADMIN_SECRET` | Yes (P4) | — | Bearer token for admin endpoints |
| `RATE_LIMIT_ENABLED` | No | `"true"` | Set `"false"` to disable rate limiting |
| `TOMBSTONE_RETENTION_DAYS` | No | `90` | Days before tombstones are eligible for cleanup |
| `LOG_LEVEL` | No | `"INFO"` | Logging level (`DEBUG`, `INFO`, `WARNING`, `ERROR`) |
| `TEST_DATABASE_URL` | CI only | — | PostgreSQL URL for integration tests |

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

This feature uses **Hypothesis** (already in `requirements.txt`) for property-based testing. Each property test runs a minimum of 200 iterations.

### Property 1: Weight Validation Rejects Out-of-Range Values

*For any* float value, the `UserProfileUpdate` schema SHALL accept it if and only if it is in the range `[1.0, 500.0]`; values outside that range SHALL produce a Pydantic `ValidationError`.

**Validates: Requirements 1.1, 4.5**

### Property 2: Height Validation Rejects Out-of-Range Values

*For any* float value, the `UserProfileUpdate` schema SHALL accept it if and only if it is in the range `[50.0, 300.0]`; values outside that range SHALL produce a `ValidationError`.

**Validates: Requirements 1.2, 4.6**

### Property 3: Birth Date Validation Rejects Non-YYYY-MM-DD Strings

*For any* string, the `UserProfileUpdate` schema SHALL accept it as `birth_date` if and only if it matches `^\d{4}-\d{2}-\d{2}$` and represents a date that is not in the future; all other strings SHALL produce a `ValidationError`.

**Validates: Requirements 1.3, 4.8, 4.9**

### Property 4: Gender Validation Accepts Only Enumerated Values

*For any* string, the `UserProfileUpdate` schema SHALL accept it as `gender` if and only if it is one of `"male"`, `"female"`, or `"other"`; all other strings SHALL produce a `ValidationError`.

**Validates: Requirements 1.4, 4.7**

### Property 5: Profile Field Round-Trip via POST /users

*For any* valid combination of `{name, weight, height, birth_date, gender}` values within the documented limits, a `POST /users` request with those values SHALL return HTTP 201 and the response body SHALL contain the exact same field values that were sent.

**Validates: Requirements 1.6, 3.1**

### Property 6: GET /users/me Returns Correct Profile for Any Authenticated User

*For any* user record stored in the database, a `GET /users/me` request bearing a JWT whose `sub` matches that user's `id` SHALL return HTTP 200 with a response body containing all six profile fields (`id`, `name`, `weight`, `height`, `birth_date`, `gender`) matching the stored values.

**Validates: Requirements 3.1**

### Property 7: PATCH /users/me Updates Only the Fields Present in the Payload

*For any* existing user profile and any non-empty subset of the five mutable fields (`name`, `weight`, `height`, `birth_date`, `gender`) with valid values, a `PATCH /users/me` request SHALL return HTTP 200, the fields present in the request body SHALL reflect the new values, and the fields absent from the request body SHALL remain unchanged.

**Validates: Requirements 4.1**

### Property 8: DELETE /users/me Removes All User Data (Cascade Completeness)

*For any* user with associated records in `workouts`, `workout_sessions`, `logged_sets`, and `deleted_records`, a `DELETE /users/me` request SHALL return HTTP 204 and subsequent queries to each of those four tables filtering by that `user_id` SHALL return zero rows.

**Validates: Requirements 5.1, 5.4, 5.6**

### Property 9: Correlation ID Round-Trip

*For any* valid UUID v4 value provided in the `X-Correlation-ID` request header, the API SHALL echo back that exact value in the `X-Correlation-ID` response header; for any request without a valid UUID v4 in that header, the response `X-Correlation-ID` SHALL contain a newly generated valid UUID v4.

**Validates: Requirements 11.1, 11.2, 11.5**

### Property 10: Structured Log Fields Present on Every Request

*For any* request to any endpoint, the structured log entry emitted on request completion SHALL be valid JSON and SHALL contain the fields `level`, `timestamp`, `message`, `method`, `path`, `status_code`, `latency_ms`, and `correlation_id`.

**Validates: Requirements 11.3, 11.4**

### Property 11: Tombstone Cleanup Respects the Retention Threshold

*For any* set of tombstone records with varying `deleted_at` timestamps, when the cleanup endpoint is invoked, exactly the records whose `deleted_at` is strictly less than `(now − TOMBSTONE_RETENTION_DAYS * 86400000 ms)` SHALL be deleted, and records at or above that threshold SHALL remain untouched.

**Validates: Requirements 10.1**

### Property 12: Rate Limit Rejects the (N+1)th Request Per User

*For any* authenticated user identity and any rate limit `N` (where `N` is the configured limit), after exactly `N` requests to a rate-limited endpoint within the window, the `(N+1)th` request SHALL receive HTTP 429 with a `Retry-After` header whose value is a positive integer ≥ 1, and different user identities SHALL have independent quota windows.

**Validates: Requirements 9.1, 9.2**

### Property 13: Integration Test Isolation — No State Leaks Between Tests

*For any* pair of integration tests that execute sequentially, the database state observed by the second test SHALL be identical to what it would observe if the first test had never run (i.e., each test starts with the same clean, Alembic-migrated schema).

**Validates: Requirements 13.7**

---

## Error Handling

### HTTP Status Code Contract

| Condition | Status | Body |
|-----------|--------|------|
| Missing / invalid JWT | 401 | `{"detail": "Token não fornecido" \| "Token inválido" \| "Token expirado"}` |
| Profile not found | 404 | `{"detail": "User profile not found"}` |
| Validation failure | 422 | `{"detail": [{"loc": [...], "msg": "...", "type": "..."}]}` |
| Rate limit exceeded | 429 | `{"error": "Rate limit exceeded"}` + `Retry-After` header |
| Database error on delete | 500 | `{"detail": "Internal server error"}` |
| Database unreachable (health) | 503 | `{"status": "degraded", "database": "unreachable"}` |

### Validation Error Detail Requirements

The 422 responses for profile field violations MUST include field-specific messages:

- **weight out of range**: `"weight must be between 1.0 and 500.0 kg"`
- **height out of range**: `"height must be between 50.0 and 300.0 cm"`
- **gender invalid**: `"gender must be one of: male, female, other"`
- **birth_date bad format**: `"birth_date must be in YYYY-MM-DD format"`
- **birth_date in future**: `"birth_date must not be a future date"`

### Transactional Safety

`DELETE /users/me` uses a single database transaction that covers all cascade deletes. If any delete operation raises an exception, `db.rollback()` is called before returning HTTP 500. No partial deletion is observable.

### Startup Failure

If `SUPABASE_URL`, `SUPABASE_JWT_SECRET`, or `DATABASE_URL` is missing at startup, pydantic-settings raises a `ValidationError` listing the missing field names. The application logs this error and exits with a non-zero exit code. The error message is in plain English and names each missing variable.

### Missing `TOMBSTONE_RETENTION_DAYS` Validation

If `TOMBSTONE_RETENTION_DAYS` is set to a value outside `[1, 3650]`, the admin endpoint returns HTTP 422 with a descriptive message before executing any deletion query.

---

## Testing Strategy

### Dual Testing Approach

Every acceptance criterion is covered by one of:
- **Property-based tests** (Hypothesis) — universal correctness across random inputs
- **Example-based unit tests** (pytest) — specific scenarios, edge cases, error conditions
- **Smoke tests** (pytest, no external deps) — structural/static assertions
- **Integration tests** (pytest + real PostgreSQL) — end-to-end DB operations

### Property-Based Tests

Uses **Hypothesis** (already installed). Each property test runs ≥ 200 examples (`@settings(max_examples=200)`). Tests are tagged with a comment linking them to the design property:

```python
# Feature: backend-fixes-and-improvements, Property 1: weight validation
@given(weight=st.floats(allow_nan=False, allow_infinity=False))
def test_property_1_weight_validation(weight):
    ...
```

Properties covered:
- Property 1–4: Schema validation (weight, height, birth_date, gender)
- Property 5: POST /users round-trip (mocked DB)
- Property 6: GET /users/me field correctness (mocked DB)
- Property 7: PATCH /users/me partial update isolation (mocked DB)
- Property 8: DELETE /users/me cascade completeness (mocked DB)
- Property 9: Correlation ID round-trip (mocked middleware)
- Property 10: Structured log fields completeness
- Property 11: Tombstone cleanup threshold correctness (mocked DB)
- Property 12: Rate limit per-user independence (mocked SlowAPI store)
- Property 13: Integration test isolation (real DB, transaction rollback fixture)

### Smoke Tests (no external deps)

| File | Tests |
|------|-------|
| `tests/smoke/test_no_legacy_sync_imports.py` | No `from app.routers.sync import` in smoke tests |
| `tests/smoke/test_env_example.py` | `.env.example` exists; no real credential patterns |
| `tests/smoke/test_migration_structure.py` | Migration 006 file exists with `upgrade`/`downgrade` |
| `tests/smoke/test_create_all_removed.py` | `create_all` absent from `app/main.py` |
| `tests/smoke/test_health_no_auth.py` | `/health` endpoint has no auth dependency |
| `tests/smoke/test_dockerfile.py` | Dockerfile exists with `HEALTHCHECK` instruction |

### Integration Tests (real PostgreSQL via Docker)

Location: `tests/integration/`

**Fixture design** (`conftest.py`):

```python
@pytest.fixture(scope="session")
def engine():
    url = os.environ["TEST_DATABASE_URL"]  # abort if missing
    engine = create_engine(url)
    # Run alembic upgrade head
    alembic_cfg = Config("alembic.ini")
    alembic_cfg.set_main_option("sqlalchemy.url", url)
    command.upgrade(alembic_cfg, "head")
    yield engine
    engine.dispose()

@pytest.fixture(autouse=True)
def db_transaction(engine):
    # Each test gets a transaction that is rolled back after completion
    with engine.connect() as conn:
        with conn.begin() as txn:
            session = Session(bind=conn)
            yield session
            txn.rollback()
```

**Tests per endpoint:**

- `test_post_users_creates_profile` — real DB insert, verify row exists
- `test_get_users_me_returns_profile` — real DB read via JWT sub
- `test_patch_users_me_partial_update` — real DB update, verify partial change

### Unit Tests for New Components

- `tests/test_health_endpoint.py` — health check with mocked DB session
- `tests/test_admin_cleanup.py` — tombstone cleanup with mocked DB
- `tests/test_correlation_middleware.py` — UUID generation and header propagation
- `tests/test_rate_limiter.py` — SlowAPI integration with mocked key function
- `tests/test_delete_user.py` — cascade delete with mocked session and rollback

### CI Pipeline Requirements

Integration test step in `.github/workflows/integration.yml`:

```yaml
services:
  postgres:
    image: postgres:16-alpine
    env:
      POSTGRES_DB: gymnight_test
      POSTGRES_USER: test
      POSTGRES_PASSWORD: test
    options: >-
      --health-cmd pg_isready
      --health-interval 2s
      --health-timeout 5s
      --health-retries 10

steps:
  - name: Run Alembic migrations
    env:
      TEST_DATABASE_URL: postgresql://test:test@localhost:5432/gymnight_test
    run: alembic upgrade head

  - name: Run integration tests
    env:
      TEST_DATABASE_URL: postgresql://test:test@localhost:5432/gymnight_test
    run: pytest tests/integration/ -v
```

### Test File Organization

```
tests/
  smoke/
    test_no_legacy_sync_imports.py    (Req 14)
    test_env_example.py               (Req 2)
    test_migration_structure.py       (Req 7)
    test_create_all_removed.py        (Req 7)
    test_health_no_auth.py            (Req 8)
    test_sync_v1_structure.py         (existing, unchanged)
    test_no_legacy_auth_imports.py    (existing, unchanged)
  integration/
    conftest.py
    test_users_api.py                 (Req 13)
  test_user_profile_properties.py    (Properties 1–8, Req 1–5)
  test_correlation_id_properties.py  (Properties 9–10, Req 11)
  test_tombstone_cleanup_properties.py (Property 11, Req 10)
  test_rate_limiter_properties.py    (Property 12, Req 9)
  test_user_router_properties.py     (existing, extended)
  test_jwt_validator_properties.py   (existing, unchanged)
  test_settings_properties.py        (existing, unchanged)
  test_sync_authorization_properties.py (existing, unchanged)
```
