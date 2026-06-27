# Requirements Document

## Introduction

This document specifies the requirements for critical bug fixes and infrastructure improvements to the GymNight backend (FastAPI + Supabase Auth + PostgreSQL + WatermelonDB Sync). The scope covers five priorities: (1) runtime-breaking bugs, (2) completing the user profile API, (3) infrastructure consolidation, (4) production readiness, and (5) test quality.

The core of the backend — WatermelonDB synchronization, Supabase JWT authentication, and multi-tenant isolation — is well implemented. The main problems are: missing profile columns in the `User` model, credentials exposed in the repository, incomplete user CRUD endpoints, and absent production infrastructure.

---

## Glossary

- **API**: The GymNight FastAPI backend.
- **Alembic**: Versioned migration tool for SQLAlchemy/PostgreSQL.
- **Client**: The GymNight mobile app that consumes the API.
- **Correlation_ID**: A unique identifier generated per request for log tracing.
- **Database**: PostgreSQL instance managed by Supabase.
- **DeletedRecord**: A tombstone record stored in the `deleted_records` table.
- **JWT**: JSON Web Token issued by Supabase Auth, carrying the user's identity.
- **Legacy_Router**: The legacy router registered at `/sync/*` (`app/routers/sync.py`).
- **Migration**: An Alembic script that alters the database schema in a versioned, reversible way.
- **Rate_Limiter**: Request rate-control middleware (SlowAPI).
- **Tombstone_Cleaner**: A periodic job that removes obsolete records from `deleted_records`.
- **User**: A user authenticated via Supabase Auth, identified by the `sub` field of the JWT.
- **User_Model**: The ORM class `User` defined in `app/database/models/user.py`.
- **User_Router**: The FastAPI router registered at `/users` (`app/routers/users.py`).
- **V1_Router**: The sync router registered at `/api/v1/sync/*` (`app/api/v1/endpoints/sync.py`).

---

## Requirements

### Requirement 1: Fix User Model — Missing Profile Fields

**User Story:** As a developer, I want the `User` ORM model to contain the fields `weight`, `height`, `birth_date`, and `gender`, so that profile creation at runtime does not fail with an attribute error.

#### Acceptance Criteria

1. THE User_Model SHALL define a `weight` column of type `Float`, nullable, with no default value, and SHALL reject values outside the range `[1.0, 500.0]` kg at the ORM validation layer.
2. THE User_Model SHALL define a `height` column of type `Float`, nullable, with no default value, and SHALL reject values outside the range `[50.0, 300.0]` cm at the ORM validation layer.
3. THE User_Model SHALL define a `birth_date` column of type `String(10)`, nullable. IF a value is provided that does not match the regex `^\d{4}-\d{2}-\d{2}$`, THEN THE User_Model SHALL raise a validation error before persisting.
4. THE User_Model SHALL define a `gender` column of type `String(10)`, nullable. IF a value is provided that is not one of `"male"`, `"female"`, or `"other"`, THEN THE User_Model SHALL raise a validation error before persisting.
5. THE Migration SHALL create the file `006_add_user_profile_fields.py` with Alembic `upgrade` and `downgrade` operations that add and remove the four columns from the `users` table.
6. WHEN the endpoint `POST /users` is called with `weight`, `height`, `birth_date`, and `gender` in the body, THE User_Router SHALL persist those values and return HTTP 201 with a response body containing the persisted field values.
7. WHEN the endpoint `POST /users` is called without the optional profile fields, THE User_Router SHALL create the record with the absent fields set to `null` in the response body.

---

### Requirement 2: Remove Exposed Credentials from Repository

**User Story:** As the security owner, I want credentials to not be tracked by git and for the `.env` file to be rotated, so that compromised secrets cannot be used by third parties.

#### Acceptance Criteria

1. THE API SHALL load `SUPABASE_URL`, `SUPABASE_JWT_SECRET`, and `DATABASE_URL` exclusively from environment variables or a local `.env` file. A grep of the source code for literal credential strings (e.g., `eyJ`, `postgresql://`, `https://*.supabase.co`) SHALL return no matches outside of `.env` and `.env.example`.
2. THE API SHALL include a `.env.example` file containing the names of all required variables with placeholder values (e.g., `SUPABASE_URL=https://your-project.supabase.co`) and no real credentials.
3. IF the `.env` file is present in the git repository (i.e., `git ls-files .env` returns a non-empty result), THEN THE Developer SHALL remove it from history and add `.env` to `.gitignore`.
4. WHEN the application initializes and any of `SUPABASE_URL`, `SUPABASE_JWT_SECRET`, or `DATABASE_URL` is not defined, THE API SHALL exit with a descriptive error message identifying each missing variable by name.
5. THE Developer SHALL rotate the exposed Supabase credentials after removing `.env` from the repository.

---

### Requirement 3: Endpoint GET /users/me — Retrieve User Profile

**User Story:** As an authenticated user, I want to retrieve my profile data via the API, so that the app can display my personal information.

#### Acceptance Criteria

1. WHEN a `GET /users/me` request is received with a valid JWT, THE User_Router SHALL return HTTP 200 with a JSON object containing the fields `id`, `name`, `weight`, `height`, `birth_date`, and `gender` of the authenticated user.
2. WHEN a `GET /users/me` request is received without a JWT or with an invalid JWT, THE User_Router SHALL return HTTP 401.
3. WHEN a `GET /users/me` request is received for a user whose profile does not exist in the database, THE User_Router SHALL return HTTP 404 with a descriptive error message.
4. THE User_Router SHALL extract the `user_id` exclusively from the `sub` field of the JWT, without accepting `user_id` as a query or path parameter.
5. WHEN a `GET /users/me` request is received with a valid JWT whose `sub` value has no matching record in the `users` table, THE User_Router SHALL return HTTP 404 with a body of `{"detail": "User profile not found"}`.

---

### Requirement 4: Endpoint PATCH /users/me — Update User Profile

**User Story:** As an authenticated user, I want to partially update my profile data, so that my information stays current in the app.

#### Acceptance Criteria

1. WHEN a `PATCH /users/me` request is received with a valid JWT and a partial body, THE User_Router SHALL update only the fields present in the body and return HTTP 200 with the complete updated profile including `id`, `name`, `weight`, `height`, `birth_date`, and `gender`.
2. WHEN a `PATCH /users/me` request is received with a valid JWT and an empty body `{}`, THE User_Router SHALL return HTTP 200 with the profile unchanged (no-op).
3. IF a `PATCH /users/me` request is received without a JWT or with an invalid JWT, THEN THE User_Router SHALL return HTTP 401.
4. IF a `PATCH /users/me` request is received for a user whose profile does not exist, THEN THE User_Router SHALL return HTTP 404.
5. WHEN the `weight` field is provided with a value outside `[1.0, 500.0]` kg, THE User_Router SHALL return HTTP 422 with a response body containing a `detail` field that names the field and states the valid range.
6. WHEN the `height` field is provided with a value outside `[50.0, 300.0]` cm, THE User_Router SHALL return HTTP 422 with a response body containing a `detail` field that names the field and states the valid range.
7. WHEN the `gender` field is provided with a value not in `{"male", "female", "other"}`, THE User_Router SHALL return HTTP 422 with a response body containing a `detail` field listing the accepted values.
8. WHEN the `birth_date` field is provided in a format other than `YYYY-MM-DD`, THE User_Router SHALL return HTTP 422 with a response body containing a `detail` field describing the expected format.
9. WHEN the `birth_date` field is provided with a date that is in the future (after the current UTC date), THE User_Router SHALL return HTTP 422 with a response body indicating that future dates are not accepted.

---

### Requirement 5: Endpoint DELETE /users/me — Delete Account (Optional)

**User Story:** As an authenticated user, I want to be able to delete my account, so that all my personal data is removed from the system.

#### Acceptance Criteria

1. WHEN a `DELETE /users/me` request is received with a valid JWT, THE User_Router SHALL delete the user's record and all associated data and return HTTP 204 with no response body.
2. WHEN a `DELETE /users/me` request is received without a JWT or with an invalid JWT, THE User_Router SHALL return HTTP 401.
3. IF the `sub` field of the JWT has no matching record in the `users` table, THEN THE User_Router SHALL return HTTP 404.
4. THE User_Router SHALL guarantee that the deletion removes all of the user's records from `workouts`, `workout_sessions`, `logged_sets`, and `deleted_records` as observable by subsequent reads returning no rows for that `user_id`.
5. WHEN the database operation fails mid-deletion, THE User_Router SHALL roll back the transaction, leaving all data intact, and return HTTP 500.
6. WHEN `DELETE /users/me` completes successfully, subsequent `GET /users/me` requests using any JWT with the same `sub` SHALL return HTTP 404.

---

### Requirement 6: Remove or Deprecate Legacy Router /sync/*

**User Story:** As a developer, I want to remove the legacy router registered at `/sync/*`, so that the codebase has only one canonical WatermelonDB sync implementation.

#### Acceptance Criteria

1. THE API SHALL expose sync routes exclusively at `/api/v1/sync/pull` and `/api/v1/sync/push` after the Legacy_Router is removed.
2. IF a client made at least one request to any `/sync/*` path within the past 30 days (as evidenced by server access logs), THEN THE API SHALL keep the Legacy_Router active and return HTTP 308 redirecting to the equivalent v1 endpoint; otherwise THE Developer MAY remove it.
3. WHEN the Legacy_Router is removed, THE API SHALL return HTTP 404 for any request to `/sync/pull` or `/sync/push`.
4. WHEN the Legacy_Router is removed, THE API SHALL respond with HTTP 2xx to requests on all `/api/v1/sync/*` endpoints (confirming v1 routes remain intact).
5. WHEN the Legacy_Router is removed, the existing smoke tests targeting `/api/v1/sync/*` endpoints SHALL all pass with zero failures or errors.

---

### Requirement 7: Configure Alembic as the Canonical Migration System

**User Story:** As a developer, I want Alembic to be the sole database migration mechanism, so that the schema evolves in a versioned, auditable, and reversible way.

#### Acceptance Criteria

1. THE Database SHALL be managed exclusively by Alembic; `Base.metadata.create_all()` SHALL NOT be called in any application runtime execution path (startup, request handlers, or CLI scripts).
2. THE Migration chain SHALL contain exactly 6 revisions (001–006), verifiable by `alembic history` listing exactly 6 entries.
3. WHEN `alembic upgrade head` is executed against an empty database, `alembic current` SHALL report `head` and `alembic check` SHALL exit with code 0.
4. WHEN `alembic downgrade -1` is executed, the row counts in all tables not targeted by that migration SHALL remain unchanged.
5. WHEN `alembic heads` is executed, it SHALL return exactly one revision identifier (no divergent branches).
6. WHEN the `DATABASE_URL` environment variable is set and non-empty, THE Alembic SHALL connect to the database and execute pending migrations with `alembic upgrade head`.

---

### Requirement 8: Endpoint GET /health — Health Check with Database Status

**User Story:** As an infrastructure operator, I want a health check endpoint that validates database connectivity, so that load balancers and monitoring systems can verify API health.

#### Acceptance Criteria

1. WHEN a `GET /health` request is received and the database is reachable, THE API SHALL return HTTP 200 with body `{"status": "ok", "database": "ok"}`.
2. WHEN a `GET /health` request is received and the database is not reachable or the connectivity check times out, THE API SHALL return HTTP 503 with body `{"status": "degraded", "database": "unreachable"}`.
3. THE API SHALL verify database connectivity by executing a lightweight check that completes within 5 seconds; the specific query is an implementation detail.
4. THE API SHALL respond to `GET /health` without requiring JWT authentication.
5. WHEN `GET /health` returns HTTP 503, THE API SHALL emit a structured log entry at level `ERROR` containing at minimum: the field `event` set to `"health_check_failed"`, the `Correlation_ID`, and the error message.

---

### Requirement 9: Rate Limiting on Sync Endpoints

**User Story:** As an infrastructure operator, I want the sync push and pull endpoints to have rate limiting, so that an abusive client cannot overwhelm the server with excessive requests.

#### Acceptance Criteria

1. WHILE the Rate_Limiter is active, THE API SHALL enforce a limit of at most 60 requests per minute per authenticated user on each of `GET /api/v1/sync/pull` and `POST /api/v1/sync/push`, evaluated as a sliding window independently per endpoint.
2. WHEN a user exceeds the configured limit on an endpoint, THE API SHALL return HTTP 429 with a `Retry-After` header whose value is a positive integer representing seconds until the next request is allowed (minimum value: 1).
3. THE Rate_Limiter SHALL identify the user by the `sub` field of the JWT. IF the JWT is missing or the `sub` field is absent, THEN THE Rate_Limiter SHALL fall back to the client IP address.
4. IF the environment variable `RATE_LIMIT_ENABLED` is set to the string `"false"`, THEN THE Rate_Limiter SHALL be disabled and all requests SHALL be processed without quota enforcement.
5. WHEN a rate-limited response is returned, THE API SHALL include an `X-RateLimit-Limit` header with the configured request limit and an `X-RateLimit-Remaining` header with the remaining quota for the current window.

---

### Requirement 10: Periodic Tombstone Cleanup

**User Story:** As an infrastructure operator, I want records in the `deleted_records` table to be removed periodically, so that the database does not grow indefinitely with obsolete tombstones.

#### Acceptance Criteria

1. THE Tombstone_Cleaner SHALL remove records from `deleted_records` whose `deleted_at` value is older than the threshold configured via `TOMBSTONE_RETENTION_DAYS` (default: 90 days). IF `TOMBSTONE_RETENTION_DAYS` is not set, THE Tombstone_Cleaner SHALL use 90 as the default. IF `TOMBSTONE_RETENTION_DAYS` is set to a value outside the range `[1, 3650]`, THE Tombstone_Cleaner SHALL reject it with a descriptive error before executing any deletion.
2. WHEN the Tombstone_Cleaner executes, THE API SHALL emit a structured log entry containing the number of records deleted and the UTC timestamp of the operation.
3. THE Tombstone_Cleaner SHALL be implemented as an endpoint `POST /admin/cleanup-tombstones` that, when called without valid admin authentication, returns HTTP 401 or HTTP 403; when called with valid admin authentication, executes the cleanup and returns HTTP 200 with body `{"deleted_count": <n>}`.
4. WHEN the cleanup operation fails due to a database error, THE Tombstone_Cleaner SHALL emit a structured log entry at level `ERROR` containing the error message and `Correlation_ID`, and return HTTP 500.

---

### Requirement 11: Structured Logging with Correlation ID

**User Story:** As a developer, I want every request to produce structured logs containing a unique correlation ID, so that I can trace the complete flow of a request in production logs.

#### Acceptance Criteria

1. IF a request arrives with a valid UUID v4 in the `X-Correlation-ID` request header, THEN THE API SHALL use that value as the `Correlation_ID` for the request.
2. IF a request arrives without the `X-Correlation-ID` header or with a value that is not a valid UUID v4, THEN THE API SHALL generate a new UUID v4 as the `Correlation_ID` for the request.
3. WHEN a request completes, THE API SHALL emit a structured log entry containing at minimum: `method`, `path`, `status_code`, `latency_ms`, and `correlation_id`.
4. THE API SHALL produce all log entries as single-line JSON objects with at minimum the fields `level`, `timestamp` (ISO 8601 UTC), `message`, and `correlation_id`.
5. THE API SHALL include the `Correlation_ID` in the `X-Correlation-ID` response header of every processed request.
6. WHILE the log level is set to `DEBUG`, THE API SHALL include the request body in log entries, excluding fields that contain JWT tokens, passwords, or API keys; IF the request body exceeds 10,000 characters, THE API SHALL truncate it and append a `[truncated]` indicator.

---

### Requirement 12: Deploy Configuration (Dockerfile / Cloud Platform)

**User Story:** As a developer, I want the backend to have deploy configuration for a cloud platform (Render, Railway, or Fly.io), so that the service can be published and scaled without manual setup.

#### Acceptance Criteria

1. THE API SHALL include a `Dockerfile` that, when built, produces an image that starts a Uvicorn server on port 8000 and begins accepting TCP connections on that port within 30 seconds of container startup.
2. THE Dockerfile SHALL use an official Python base image (e.g., `python:3.12-slim`) and install only the dependencies listed in `requirements.txt`.
3. THE API SHALL include a platform configuration file (`render.yaml`, `railway.toml`, or `fly.toml`) that specifies at minimum: the build command, the start command, the port (`8000`), and the names of all required environment variables.
4. WHEN the image is built with `docker build`, THE build SHALL complete without errors (exit code 0).
5. WHEN the container is started with all required environment variables set to non-empty values, THE API SHALL initialize and respond to `GET /health` with HTTP 200 within 30 seconds.
6. THE Dockerfile SHALL include a `HEALTHCHECK` instruction that calls `GET /health` with a timeout of 5 seconds, an interval of 30 seconds, and a start period of 10 seconds.

---

### Requirement 13: Integration Tests with Real PostgreSQL

**User Story:** As a developer, I want integration tests to run against a real PostgreSQL instance (via Docker in CI), so that PostgreSQL-specific behaviors (triggers, constraints, indexes) are validated before merge.

#### Acceptance Criteria

1. THE Test_Suite SHALL include integration tests that run against a real PostgreSQL instance provisioned via Docker Compose or a CI service.
2. WHEN the integration tests are executed with `TEST_DATABASE_URL` set to a non-empty value, THE Test_Suite SHALL connect to that PostgreSQL instance without fallback to any other database.
3. IF `TEST_DATABASE_URL` is not set, THEN THE Test_Suite SHALL abort all integration tests before any execute and emit an error message identifying the missing variable.
4. WHEN the integration tests begin, THE Test_Suite SHALL run `alembic upgrade head` against the test database before any test executes. IF the migration fails, THE Test_Suite SHALL abort all tests before any execute.
5. WHEN the CI pipeline runs integration tests, THE CI_Pipeline SHALL verify PostgreSQL is ready (accepting connections on the configured port) before executing migrations, and SHALL execute migrations before running any test.
6. THE Test_Suite SHALL include at least one integration test for each of `POST /users`, `GET /users/me`, and `PATCH /users/me` that performs real database read/write operations with no mocks on the database layer.
7. WHEN multiple integration tests execute sequentially, each test SHALL start with an isolated database state achieved via transaction rollback or schema reset after each test, preventing dirty state from affecting subsequent tests.

---

### Requirement 14: Remove Legacy Router from Tests

**User Story:** As a developer, I want the smoke tests to not import or verify the legacy `/sync/*` router, so that removing the Legacy_Router does not break the test suite.

#### Acceptance Criteria

1. WHEN the smoke tests are executed after the Legacy_Router is removed, THE Test_Suite SHALL complete with zero test failures and zero errors.
2. THE Test_Suite SHALL contain no statements of the form `from app.routers.sync import ...` or `import app.routers.sync` in any smoke test file.
3. WHEN the smoke tests are executed, THE Test_Suite SHALL verify only the endpoints `GET /api/v1/sync/pull`, `POST /api/v1/sync/push`, `GET /users`, `POST /users`, and `GET /users/{id}`, and SHALL NOT send requests to any `/sync/*` path.
