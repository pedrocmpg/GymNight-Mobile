 # Implementation Plan: Backend Fixes and Improvements

## Overview

This plan covers all five priority tiers for the GymNight FastAPI backend in a dependency-safe order:
P1 (critical runtime fixes) → P2 (user profile API) → P3 (infrastructure consolidation) → P4 (production readiness) → P5 (test quality). Each task builds directly on previous ones; no orphaned code is introduced.

Stack: FastAPI + SQLAlchemy (sync) + PostgreSQL (Supabase) + Alembic + structlog + slowapi + Hypothesis

---

## Tasks

- [x] 1. Fix User ORM model and add Alembic migration 006
  - [x] 1.1 Add `weight`, `height`, `birth_date`, and `gender` columns to the `User` ORM model
    - Open `app/database/models/user.py`
    - Add `Column(Float, nullable=True)` for `weight` and `height`
    - Add `Column(String(10), nullable=True)` for `birth_date` and `gender`
    - Add `@validates("weight")` — reject values outside `[1.0, 500.0]`
    - Add `@validates("height")` — reject values outside `[50.0, 300.0]`
    - Add `@validates("birth_date")` — reject strings not matching `^\d{4}-\d{2}-\d{2}$`
    - Add `@validates("gender")` — reject values not in `{"male", "female", "other"}`
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [x] 1.2 Create Alembic migration `006_add_user_profile_fields.py`
    - Create `app/database/migrations/alembic/versions/006_add_user_profile_fields.py`
    - Set `revision = "006"` and `down_revision = "005"`
    - `upgrade()`: `op.add_column` for all four new columns
    - `downgrade()`: `op.drop_column` for all four columns in reverse order
    - _Requirements: 1.5_

  - [x] 1.3 Write property tests for ORM field validators (Properties 1–4)
    - Create `tests/test_user_profile_properties.py`
    - **Property 1: Weight validation rejects out-of-range values**
    - **Validates: Requirements 1.1, 4.5**
    - **Property 2: Height validation rejects out-of-range values**
    - **Validates: Requirements 1.2, 4.6**
    - **Property 3: Birth date validation rejects non-YYYY-MM-DD strings**
    - **Validates: Requirements 1.3, 4.8, 4.9**
    - **Property 4: Gender validation accepts only enumerated values**
    - **Validates: Requirements 1.4, 4.7**
    - Use `@settings(max_examples=200)` and `@given(st.floats(...))` / `@given(st.text())`

- [x] 2. Secure credentials — remove `.env` from git tracking
  - [x] 2.1 Add `.env` to `.gitignore` and create `.env.example`
    - Verify `.env` is not already in `.gitignore`; add it if missing
    - Create `.env.example` with placeholder values for `SUPABASE_URL`, `SUPABASE_JWT_SECRET`, `DATABASE_URL`, `ADMIN_SECRET`, `RATE_LIMIT_ENABLED`, `TOMBSTONE_RETENTION_DAYS`, `LOG_LEVEL`, `TEST_DATABASE_URL`
    - Do NOT include real credentials in `.env.example`
    - _Requirements: 2.2_

  - [x] 2.2 Add startup validation for missing required environment variables
    - Open `app/core/config.py`
    - Confirm pydantic-settings `Settings` model declares `SUPABASE_URL`, `SUPABASE_JWT_SECRET`, and `DATABASE_URL` as required (no default values)
    - Verify that a missing variable raises a `ValidationError` naming the missing field; add an explicit startup check with a descriptive error log if pydantic-settings alone is insufficient
    - _Requirements: 2.4_

- [x] 3. Checkpoint — run existing smoke tests
  - Run `pytest tests/smoke/ -v` and confirm zero failures before proceeding.
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Add Pydantic user schema validators and complete `POST /users`
  - [x] 4.1 Create or update `app/schemas/user.py` with `UserProfileCreate` and `UserProfileUpdate`
    - Add `UserProfileCreate(BaseModel)` with `name`, `weight`, `height`, `birth_date`, `gender` — all optional except `name` for create
    - Add `UserProfileUpdate(BaseModel)` with all five fields optional
    - Add `@field_validator("weight")` — raise `ValueError` outside `[1.0, 500.0]`
    - Add `@field_validator("height")` — raise `ValueError` outside `[50.0, 300.0]`
    - Add `@field_validator("birth_date")` — reject non-`YYYY-MM-DD` and future dates
    - Add `@field_validator("gender")` — reject values not in `{"male", "female", "other"}`
    - Set `model_config = ConfigDict(extra="forbid")`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 4.5, 4.6, 4.7, 4.8, 4.9_

  - [x] 4.2 Update `POST /users` in `app/routers/users.py` to persist profile fields
    - Pass `weight`, `height`, `birth_date`, `gender` from the validated `UserProfileCreate` schema into the `User` ORM object
    - Return HTTP 201 with all persisted fields including nulls for absent optional fields
    - _Requirements: 1.6, 1.7_

- [x] 5. Implement `GET /users/me`, `PATCH /users/me`, and `DELETE /users/me`
  - [x] 5.1 Implement `GET /users/me`
    - Add `@router.get("/users/me")` in `app/routers/users.py`
    - Depend on `get_current_user` to extract `user_id` from JWT `sub`; never accept `user_id` as a path or query parameter
    - Query the `users` table by `id == user_id`
    - Return HTTP 200 with `{id, name, weight, height, birth_date, gender}` if found
    - Return HTTP 401 for missing/invalid JWT; HTTP 404 with `{"detail": "User profile not found"}` if no matching record
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 5.2 Implement `PATCH /users/me`
    - Add `@router.patch("/users/me")` in `app/routers/users.py`
    - Accept a `UserProfileUpdate` body; iterate only over fields explicitly provided (use `model_dump(exclude_unset=True)`)
    - If the body is `{}`, return HTTP 200 with the profile unchanged
    - Return HTTP 401 (no/invalid JWT), HTTP 404 (profile not found), HTTP 422 (validation error) as appropriate
    - Return HTTP 200 with the complete updated profile on success
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9_

  - [x] 5.3 Implement `DELETE /users/me`
    - Add `@router.delete("/users/me", status_code=204)` in `app/routers/users.py`
    - Wrap all deletes (user row + `workouts`, `workout_sessions`, `logged_sets`, `deleted_records` rows by `user_id`) in a single transaction
    - Call `db.rollback()` and return HTTP 500 if any delete fails
    - Return HTTP 204 (no body) on success
    - Return HTTP 401 (no/invalid JWT) and HTTP 404 (profile not found)
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

  - [x] 5.4 Write property tests for user profile endpoints (Properties 5–8)
    - Extend `tests/test_user_profile_properties.py`
    - **Property 5: Profile field round-trip via POST /users**
    - **Validates: Requirements 1.6, 3.1**
    - **Property 6: GET /users/me returns correct profile for any authenticated user**
    - **Validates: Requirements 3.1**
    - **Property 7: PATCH /users/me updates only the fields present in the payload**
    - **Validates: Requirements 4.1**
    - **Property 8: DELETE /users/me removes all user data (cascade completeness)**
    - **Validates: Requirements 5.1, 5.4, 5.6**
    - Use mocked DB session for Properties 5–8

- [x] 6. Checkpoint — validate P1 + P2
  - Run `pytest tests/ -v --ignore=tests/integration` and confirm zero failures.
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Infrastructure consolidation — remove legacy router and `create_all`
  - [x] 7.1 Remove `Base.metadata.create_all()` from `app/main.py`
    - Delete the `models.Base.metadata.create_all(bind=engine)` call from `app/main.py`
    - Confirm the application still starts without this call (Alembic must be run separately)
    - _Requirements: 7.1_

  - [x] 7.2 Remove the legacy `/sync/*` router registration from `app/main.py`
    - Delete or comment out `app.include_router(sync.router)` (the legacy `/sync/*` registration)
    - Verify that `app.include_router` for `/api/v1/sync/*` (V1_Router) remains intact
    - _Requirements: 6.1, 6.3, 6.4_

  - [x] 7.3 Convert existing migration scripts 001–005 to proper Alembic revision files
    - Create `alembic/versions/001_initial_schema.py` through `alembic/versions/005_add_offline_sync_triggers.py` as proper Alembic revision files (with `revision`, `down_revision`, `upgrade`, `downgrade`) based on the existing standalone migration scripts
    - Ensure the chain is linear: `001 → 002 → 003 → 004 → 005 → 006`
    - Verify `alembic history` lists exactly 6 entries and `alembic heads` returns exactly one revision
    - _Requirements: 7.2, 7.3, 7.4, 7.5_

- [x] 8. Add `GET /health` endpoint
  - [x] 8.1 Create `app/routers/health.py` with the health check endpoint
    - Implement `GET /health` with no authentication dependency
    - Execute `db.execute(text("SELECT 1"))` within a 5-second timeout to check connectivity
    - Return `{"status": "ok", "database": "ok"}` (HTTP 200) on success
    - Return `{"status": "degraded", "database": "unreachable"}` (HTTP 503) on failure; emit a structlog `ERROR` entry with fields `event="health_check_failed"`, `correlation_id`, and `error`
    - Register the router in `app/main.py`
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [x] 9. Checkpoint — validate P3
  - Run `pytest tests/smoke/ -v` and confirm zero failures. Spot-check `alembic history` output if Alembic is accessible.
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Add structured logging with Correlation ID middleware
  - [x] 10.1 Set up structlog configuration in `app/core/logging.py`
    - Configure `structlog` to produce single-line JSON log entries with fields `level`, `timestamp` (ISO 8601 UTC), `message`, and `correlation_id`
    - Add `LOG_LEVEL` env var support (`DEBUG`, `INFO`, `WARNING`, `ERROR`; default `INFO`)
    - When `LOG_LEVEL=DEBUG`, log the request body excluding JWT tokens, passwords, and API keys; truncate bodies exceeding 10,000 characters with `[truncated]`
    - _Requirements: 11.4, 11.6_

  - [x] 10.2 Create `app/middleware/correlation_id.py` — `CorrelationIDMiddleware`
    - Accept `X-Correlation-ID` header; use it if it is a valid UUID v4, otherwise generate a new UUID v4
    - Bind `correlation_id` to the structlog context via `structlog.contextvars.bind_contextvars`
    - Echo the `Correlation_ID` back in the `X-Correlation-ID` response header
    - Register the middleware in `app/main.py` (outermost position)
    - _Requirements: 11.1, 11.2, 11.5_

  - [x] 10.3 Create `app/middleware/access_log.py` — `AccessLogMiddleware`
    - Record `time.monotonic()` before calling `call_next`
    - Emit a structlog `INFO` entry after the response with fields `method`, `path`, `status_code`, `latency_ms`, `correlation_id`
    - Register the middleware in `app/main.py` (after `CorrelationIDMiddleware`)
    - _Requirements: 11.3_

  - [x] 10.4 Write property tests for Correlation ID middleware (Properties 9–10)
    - Create `tests/test_correlation_id_properties.py`
    - **Property 9: Correlation ID round-trip**
    - **Validates: Requirements 11.1, 11.2, 11.5**
    - **Property 10: Structured log fields present on every request**
    - **Validates: Requirements 11.3, 11.4**
    - Use `TestClient` with a minimal FastAPI test app; capture log output with a custom structlog processor

- [x] 11. Add SlowAPI rate limiting on sync endpoints
  - [x] 11.1 Integrate SlowAPI limiter into `app/main.py`
    - Implement `_get_rate_limit_key(request)` — extract `sub` from JWT if present, else fall back to `request.client.host`
    - Instantiate `Limiter(key_func=_get_rate_limit_key)` and attach to `app.state.limiter`
    - Add `RateLimitExceeded` exception handler that returns HTTP 429 with `{"error": "Rate limit exceeded"}`, `Retry-After`, `X-RateLimit-Limit`, and `X-RateLimit-Remaining` headers
    - Gate the limiter with `RATE_LIMIT_ENABLED` env var (default `"true"`; set `"false"` to disable)
    - _Requirements: 9.3, 9.4, 9.5_

  - [x] 11.2 Decorate sync endpoints with `@limiter.limit("60/minute")`
    - Apply the decorator to `GET /api/v1/sync/pull` and `POST /api/v1/sync/push` in `app/api/v1/endpoints/sync.py`
    - Confirm requests beyond the 60/min limit receive HTTP 429 with the required headers
    - _Requirements: 9.1, 9.2_

  - [x] 11.3 Write property test for rate limiting per-user independence (Property 12)
    - Create `tests/test_rate_limiter_properties.py`
    - **Property 12: Rate limit rejects the (N+1)th request per user**
    - **Validates: Requirements 9.1, 9.2**
    - Use a mocked SlowAPI in-memory store; test that two distinct JWT `sub` values have independent quota windows

- [x] 12. Add tombstone cleanup admin endpoint
  - [x] 12.1 Create `app/routers/admin.py` with `POST /admin/cleanup-tombstones`
    - Implement `_require_admin` dependency that checks `Authorization: Bearer <ADMIN_SECRET>`; return HTTP 401 if missing or incorrect
    - Read `TOMBSTONE_RETENTION_DAYS` from settings (default `90`); validate it is within `[1, 3650]` and return HTTP 422 with a descriptive message if not
    - Delete from `deleted_records` where `deleted_at < (now − retention_days * 86_400_000 ms)` using `synchronize_session=False`
    - `db.commit()` on success; emit structlog `INFO` with `deleted_count` and UTC timestamp
    - `db.rollback()` on failure; emit structlog `ERROR` with `error` and `correlation_id`; return HTTP 500
    - Return HTTP 200 with `{"deleted_count": n}` on success
    - Register `admin.router` in `app/main.py`
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

  - [x] 12.2 Write property test for tombstone cleanup threshold (Property 11)
    - Create `tests/test_tombstone_cleanup_properties.py`
    - **Property 11: Tombstone cleanup respects the retention threshold**
    - **Validates: Requirements 10.1**
    - Use a mocked DB session that records which row IDs were deleted; generate arbitrary sets of `deleted_at` timestamps and verify exactly the correct rows are deleted

- [x] 13. Add Dockerfile and deploy configuration
  - [x] 13.1 Create `Dockerfile` with `HEALTHCHECK` instruction
    - Use `python:3.12-slim` as the base image
    - Copy `requirements.txt` and install dependencies with `pip install --no-cache-dir -r requirements.txt`
    - Copy application source
    - Expose port `8000`; set `CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]`
    - Add `HEALTHCHECK --interval=30s --timeout=5s --start-period=10s CMD curl -f http://localhost:8000/health || exit 1`
    - _Requirements: 12.1, 12.2, 12.4, 12.5, 12.6_

  - [x] 13.2 Create `render.yaml` (or `railway.toml`) deploy configuration
    - Specify build command (`pip install -r requirements.txt`), start command (`uvicorn app.main:app --host 0.0.0.0 --port 8000`), port (`8000`)
    - List all required environment variable names: `SUPABASE_URL`, `SUPABASE_JWT_SECRET`, `DATABASE_URL`, `ADMIN_SECRET`
    - _Requirements: 12.3_

- [x] 14. Checkpoint — validate P4
  - Run `pytest tests/ -v --ignore=tests/integration` and confirm zero failures.
  - Ensure all tests pass, ask the user if questions arise.

- [x] 15. Update smoke tests for new structural invariants
  - [x] 15.1 Remove legacy router imports from all smoke test files
    - Search `tests/smoke/` for any `from app.routers.sync import` or `import app.routers.sync` statements and remove them
    - _Requirements: 14.1, 14.2_

  - [x] 15.2 Add smoke tests for P3 invariants
    - Create `tests/smoke/test_create_all_removed.py` — assert that the string `create_all` does not appear in `app/main.py`
    - Create `tests/smoke/test_env_example.py` — assert that `.env.example` exists and contains no real credential patterns (`eyJ`, `postgresql://.*@`, `https://[a-z]*.supabase.co` with non-placeholder host)
    - Create `tests/smoke/test_migration_structure.py` — assert that `alembic/versions/006_add_user_profile_fields.py` exists and contains both `upgrade` and `downgrade` function definitions
    - Create `tests/smoke/test_health_no_auth.py` — assert that the `/health` route definition in `app/routers/health.py` has no `Depends(get_current_user)` call
    - Create `tests/smoke/test_dockerfile.py` — assert that `Dockerfile` exists and contains a line matching `^HEALTHCHECK`
    - _Requirements: 7.1, 14.1_

  - [x] 15.3 Update existing sync smoke tests to only target `/api/v1/sync/*`
    - Open any existing smoke test file that currently tests sync endpoints
    - Remove or replace any request to `/sync/pull` or `/sync/push` with equivalent requests to `/api/v1/sync/pull` and `/api/v1/sync/push`
    - _Requirements: 6.5, 14.3_

- [x] 16. Add integration tests against real PostgreSQL
  - [x] 16.1 Create `tests/integration/conftest.py` with session-scoped engine and per-test transaction rollback fixture
    - Read `TEST_DATABASE_URL` from env; abort (skip all integration tests with a descriptive error) if not set
    - Create a session-scoped `engine` fixture that runs `alembic upgrade head` before any test
    - Create an `autouse=True` per-test `db_transaction` fixture that opens a connection, begins a transaction, yields a `Session`, and rolls back after each test
    - _Requirements: 13.2, 13.3, 13.4, 13.7_

  - [x] 16.2 Create `tests/integration/test_users_api.py` with integration tests for `POST`, `GET`, and `PATCH /users`
    - `test_post_users_creates_profile` — insert via `POST /users`, query the DB directly, verify the row exists with correct field values
    - `test_get_users_me_returns_profile` — pre-insert a user row, call `GET /users/me` with a matching JWT, verify the response body
    - `test_patch_users_me_partial_update` — pre-insert a user row, call `PATCH /users/me` with a partial body, verify only the sent fields changed in the DB
    - _Requirements: 13.1, 13.5, 13.6_

  - [x] 16.3 Write property test for integration test isolation (Property 13)
    - Add `test_property_13_no_state_leaks` to `tests/integration/test_users_api.py`
    - **Property 13: Integration test isolation — no state leaks between tests**
    - **Validates: Requirements 13.7**
    - Use `@given(st.integers(min_value=1, max_value=20))` to generate an arbitrary number of sequential test operations and verify the DB is clean before each

- [x] 17. Add GitHub Actions CI workflow
  - [x] 17.1 Create `.github/workflows/integration.yml`
    - Define a `postgres` service (`postgres:16-alpine`) with `POSTGRES_DB=gymnight_test`, `POSTGRES_USER=test`, `POSTGRES_PASSWORD=test`, and a `pg_isready` health check
    - Add a `Run Alembic migrations` step with `TEST_DATABASE_URL=postgresql://test:test@localhost:5432/gymnight_test`; abort if migrations fail
    - Add a `Run integration tests` step: `pytest tests/integration/ -v` with the same `TEST_DATABASE_URL`
    - _Requirements: 13.4, 13.5_

- [x] 18. Final checkpoint — full test suite
  - Run `pytest tests/smoke/ tests/ -v --ignore=tests/integration` and confirm zero failures.
  - Ensure all tests pass, ask the user if questions arise.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP.
- Each task references specific requirements for traceability.
- Checkpoints (tasks 3, 6, 9, 14, 18) ensure incremental validation at each priority tier boundary.
- Property tests (1.3, 5.4, 10.4, 11.3, 12.2, 16.3) use `@settings(max_examples=200)` and cover all 13 correctness properties defined in the design.
- `.env` must be manually removed from git history by the developer after completing task 2.1 (`git rm --cached .env`); this cannot be done by a coding agent.
- `alembic upgrade head` must be run manually (or via CI) before starting the server; it is not automated at startup per requirement 7.1.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "2.1"] },
    { "id": 1, "tasks": ["1.2", "2.2"] },
    { "id": 2, "tasks": ["1.3", "4.1"] },
    { "id": 3, "tasks": ["4.2"] },
    { "id": 4, "tasks": ["5.1", "5.2", "5.3"] },
    { "id": 5, "tasks": ["5.4"] },
    { "id": 6, "tasks": ["7.1", "7.2"] },
    { "id": 7, "tasks": ["7.3", "8.1"] },
    { "id": 8, "tasks": ["10.1"] },
    { "id": 9, "tasks": ["10.2", "10.3"] },
    { "id": 10, "tasks": ["10.4", "11.1"] },
    { "id": 11, "tasks": ["11.2", "12.1"] },
    { "id": 12, "tasks": ["11.3", "12.2", "13.1"] },
    { "id": 13, "tasks": ["13.2"] },
    { "id": 14, "tasks": ["15.1", "15.2", "15.3"] },
    { "id": 15, "tasks": ["16.1"] },
    { "id": 16, "tasks": ["16.2"] },
    { "id": 17, "tasks": ["16.3", "17.1"] }
  ]
}
```
