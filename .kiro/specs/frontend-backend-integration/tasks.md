# Implementation Plan: Frontend-Backend Integration

## Overview

This plan wires already-implemented, already-tested auth/sync/screen modules to real infrastructure. Implementation proceeds bottom-up: Env_Config first (nothing else can be constructed without it), then the Supabase-backed auth adapters and Session_Store, then the Sync_Cycle_Runner (built from existing pure sync helpers), then the navigation layer and screen containers, then the backend migration, finishing with the Bootstrap_Sequence wiring in `App.tsx` and the end-to-end validation. Property-based tests (fast-check, frontend) are placed as sub-tasks immediately after the implementation they validate, per the project's one-file-per-property convention (`src/{auth,sync,navigation}/__tests__/<Module>.propertyN.test.ts`, header-tagged, `numRuns: 100`). No backend property tests are added (Requirements 12/13 are SMOKE/INTEGRATION only per the design's Testing Strategy).

## Quick Reference: Physical Device Build Flow

```bash
# Terminal 1: Backend (listens on 0.0.0.0:8000, accessible at 192.168.0.102)
cd gymnight/backend
uvicorn app.main:app --host 0.0.0.0 --port 8000

# Terminal 2: Frontend (detect & deploy to USB-connected device)
cd gymnight/frontend
adb devices                    # Verify device is connected
npx expo run:android           # Builds APK + deploys directly to device
                                # Metro bundler starts; hot-reload available
```

**Key Points:**
- Device must be connected via USB before running `npx expo run:android`
- Device and dev machine must be on same Wi-Fi network (192.168.0.102)
- Frontend config uses `EXPO_PUBLIC_BACKEND_BASE_URL=http://192.168.0.102:8000`
- No localhost/10.0.2.2/emulator references
- Backend must bind to `0.0.0.0` to be reachable from device on different network interface

## Environment Documentation

**Physical Device Setup (USB + Linux + Expo):**
- **Quick Start:** [DEVICE_USB_QUICK_START.md](../../DEVICE_USB_QUICK_START.md)
- **Deployment Checklist:** [PHYSICAL_DEVICE_CHECKLIST.md](../PHYSICAL_DEVICE_CHECKLIST.md)
- **Migration Summary:** [ENVIRONMENT_MIGRATION_SUMMARY.md](../ENVIRONMENT_MIGRATION_SUMMARY.md)

**Key Configuration:**
- Machine IP: `192.168.0.102` (primary), `172.17.0.1` (fallback)
- Backend: `http://192.168.0.102:8000` (must bind to `0.0.0.0`)
- Frontend: `EXPO_PUBLIC_BACKEND_BASE_URL=http://192.168.0.102:8000`
- Device: Connected via USB, on same Wi-Fi as dev machine

## Tasks

- [x] 1. Implement Env_Config module
  - [x] 1.1 Create `src/config/env.ts` with `EnvConfig`, `EnvValidationResult`, and `validateEnvConfig`
    - Implement presence/empty/whitespace checks for all three `EXPO_PUBLIC_*` variables
    - Implement URL-well-formedness check (`new URL(value)` throws) for `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_BACKEND_BASE_URL` only
    - Return `offending` names in the fixed order `[EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY, EXPO_PUBLIC_BACKEND_BASE_URL]`, filtered to failures
    - _Requirements: 1.1, 1.2, 1.3, 1.6, 2.2_

  - [x]* 1.2 Write property test for Env_Config validation
    - **Property 1: Env validation reports exactly the offending variables**
    - **Validates: Requirements 1.6**
    - File: `src/config/__tests__/env.property1.test.ts`

  - [x] 1.3 Create `gymnight/frontend/.env.example` and verify `.gitignore` coverage
    - List `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_BACKEND_BASE_URL` with non-functional placeholder values
    - `EXPO_PUBLIC_BACKEND_BASE_URL` example: `http://192.168.0.102:8000` (physical device on same Wi-Fi network)
    - Confirm local `.env` is excluded from version control via `.gitignore`
    - _Requirements: 1.4, 1.5_

  - [x]* 1.4 Write structural/grep-based tests for secret hygiene
    - Assert no literal Supabase/backend URL or key values (plain, concatenated, or encoded) exist in any `.ts`/`.tsx`/`.js`/`.jsx`/`.json` file under `src/`
    - Assert `.env.example` contains the three expected keys with placeholder (non-functional) values
    - _Requirements: 2.1, 1.4_

- [x] 2. Implement Supabase_Client construction
  - [x] 2.1 Create `src/auth/supabaseClient.ts` with `createSupabaseClient(config: EnvConfig): SupabaseClient`
    - Single call site for `createClient` from `@supabase/supabase-js`
    - _Requirements: 2.3, 3.1_

  - [x]* 2.2 Write structural test for single `createClient`/Env_Config read-site enforcement
    - Assert exactly one source file calls `createClient`, exactly one file reads `Backend_Base_URL`, and no `EXPO_PUBLIC_*` read exists outside the Supabase_Client and Sync_Cycle_Runner construction files
    - _Requirements: 2.3, 2.4, 2.5_

- [x] 3. Implement SupabaseAuthClient adapter
  - [x] 3.1 Create `src/auth/supabaseAuthClientAdapter.ts` with `createSupabaseAuthClientAdapter(client): SupabaseAuthClient`
    - Implement `signInWithPassword` mapping success (session fields carried through unchanged), declared Supabase error, and thrown/rejected failures into the existing `SupabaseAuthClient` shape via a single try/catch, without modifying the `SupabaseAuthClient` interface in `AuthManager.ts`
    - _Requirements: 3.2, 3.3, 3.4, 14.3_

  - [x]* 3.2 Write property test for successful sign-in field mapping
    - **Property 2: SupabaseAuthClient adapter preserves successful sign-in fields**
    - **Validates: Requirements 3.2**
    - File: `src/auth/__tests__/supabaseAuthClientAdapter.property2.test.ts`

  - [x]* 3.3 Write property test for error message mapping
    - **Property 3: SupabaseAuthClient adapter preserves error messages**
    - **Validates: Requirements 3.3**
    - File: `src/auth/__tests__/supabaseAuthClientAdapter.property3.test.ts`

  - [x]* 3.4 Write property test for never propagating uncaught exceptions
    - **Property 4: SupabaseAuthClient adapter never propagates an uncaught exception**
    - **Validates: Requirements 3.4**
    - File: `src/auth/__tests__/supabaseAuthClientAdapter.property4.test.ts`

- [x] 4. Implement Token_Validator (JWT expiration check)
  - [x] 4.1 Create `src/auth/jwtTokenValidator.ts` with `decodeJwtPayload` (base64url + JSON.parse, no library) and `jwtTokenValidator: TokenValidator`
    - `isExpired` returns `true` for undecodable tokens, tokens missing a numeric `exp`, or `exp` <= current time (seconds)
    - _Requirements: 4.1, 4.2_

  - [x]* 4.2 Write property test for token expiration logic
    - **Property 5: Token expiration matches the exp-claim comparison, and undecodable tokens are always expired**
    - **Validates: Requirements 4.1, 4.2**
    - File: `src/auth/__tests__/jwtTokenValidator.property5.test.ts`

- [x] 5. Implement Session_Refresher adapter
  - [x] 5.1 Create `src/auth/supabaseSessionRefresher.ts` with `createSupabaseSessionRefresher(client): SessionRefresher`
    - Map successful `refreshSession` response to the `SessionRefresher` success shape carrying `access_token`, `refresh_token`, `user_id` unchanged
    - Map declared error or null session, and thrown/rejected failures, to the `SessionRefresher` error shape without updating stored session
    - _Requirements: 4.3, 4.4_

  - [x]* 5.2 Write property test for successful refresh field mapping
    - **Property 6: SessionRefresher adapter preserves successful refresh fields**
    - **Validates: Requirements 4.3**
    - File: `src/auth/__tests__/supabaseSessionRefresher.property6.test.ts`

  - [x]* 5.3 Write property test for failed refresh never persisting
    - **Property 7: Failed refresh never updates the stored session**
    - **Validates: Requirements 4.4**
    - File: `src/auth/__tests__/supabaseSessionRefresher.property7.test.ts`

- [x] 6. Implement Session_Store
  - [x] 6.1 Create `src/auth/sessionStore.ts` with `SessionStore` interface and `createSessionStore()` (in-memory `set`/`clear`/`getCurrentSession`)
    - `getCurrentSession` satisfies `AuthInterceptor`'s `SessionProvider` contract
    - _Requirements: 10.2_

  - [x] 6.2 Wire session-producing call sites to `sessionStore.set`/`clear`
    - Wrap `AuthManager.signIn()`, `AuthManager.restoreSession()` success results, and every successful `SessionRefresher.refresh()` result to call `sessionStore.set(session)`
    - Ensure `LogoutStoragePort` adapter (task 7.2) calls `sessionStore.clear()` in the same call that clears SecureStorage
    - _Requirements: 4.7, 10.2, 10.3_

  - [x]* 6.3 Write property test for successful refresh propagation to storage and provider
    - **Property 8: Successful refresh propagates identically to storage and the session provider**
    - **Validates: Requirements 4.7**
    - File: `src/auth/__tests__/sessionRefreshPropagation.property8.test.ts`

  - [x]* 6.4 Write property test for SessionProvider reflecting the latest session event
    - **Property 21: SessionProvider always reflects the most recent session-producing event, or null after logout**
    - **Validates: Requirements 10.2**
    - File: `src/auth/__tests__/sessionStore.property21.test.ts`

- [x] 7. Implement logout port adapters
  - [x] 7.1 Create `src/auth/logoutAdapters.ts`: `createSupabaseLogoutPort(client): SupabaseLogoutPort`
    - Call `client.auth.signOut()`; throw on declared error; let thrown/rejected failures propagate unchanged
    - _Requirements: 7.1_

  - [x] 7.2 Add `createLogoutStoragePort(sessionStore): LogoutStoragePort` to `src/auth/logoutAdapters.ts`
    - Call existing `clearSession()` from `SecureStorage.ts`, then `sessionStore.clear()`; propagate any failure unchanged
    - _Requirements: 7.2, 10.3_

  - [x] 7.3 Add `createLogoutWipePort(db): LogoutWipePort` to `src/auth/logoutAdapters.ts`
    - Delete all records across the six WatermelonDB tables (`users`, `exercises`, `workouts`, `workout_exercises`, `workout_sessions`, `logged_sets`) inside `db.write`, then call `clearLastPulledAt()` from `lastPulledAt.ts`; propagate any sub-operation failure unchanged
    - _Requirements: 7.3_

  - [x] 7.4 Wire the three logout port adapters into `Logout_Manager`'s constructor (Bootstrap_Sequence wiring point, implemented fully in task 12)
    - _Requirements: 7.4_

  - [x]* 7.5 Write property test for SupabaseLogoutPort failure propagation
    - **Property 11: Supabase logout port adapter always propagates signOut failures**
    - **Validates: Requirements 7.1**
    - File: `src/auth/__tests__/logoutAdapters.property11.test.ts`

  - [x]* 7.6 Write property test for LogoutStoragePort failure propagation
    - **Property 12: Logout storage port adapter always propagates clearSession failures**
    - **Validates: Requirements 7.2**
    - File: `src/auth/__tests__/logoutAdapters.property12.test.ts`

  - [x]* 7.7 Write property test for LogoutWipePort failure propagation
    - **Property 13: Logout wipe port adapter always propagates a failure in any sub-operation**
    - **Validates: Requirements 7.3**
    - File: `src/auth/__tests__/logoutAdapters.property13.test.ts`

- [x] 8. Checkpoint - Ensure all auth-layer tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Implement Sync_Cycle_Runner HTTP layer and push branch
  - [x] 9.1 Create `src/sync/syncCycleRunner.ts` with `SyncHttpClient`, `HttpResult` types and the `createSyncCycleRunner(deps)` composition function
    - Read `backend_base_url` from `EnvConfig` only at construction time (single call site)
    - _Requirements: 2.4, 9.1_

  - [x] 9.2 Implement `runPushBranch` per the design's push outcome table
    - Skip push and proceed to pull when queue is empty; send exactly one POST with `buildPushPayload(queue)` body via Auth_Interceptor's `attachAuthHeader` when non-empty
    - Handle: no-session-available (abort, no push, unmodified queue), HTTP 200 `{status:'ok'}` → `markRecordsAsSynced`, HTTP 403 → `quarantineRejectedPayload` (whole payload, no retry, proceed to pull), HTTP 401 `"Token expirado"` → one `Token_Refresh_Coordinator.refresh` + one retry, HTTP 500 and network error → unmodified queue, no pull, no throw
    - _Requirements: 9.2, 9.3, 10.1, 10.4, 11.1, 11.2, 11.3, 11.4, 11.6_

  - [x]* 9.3 Write property test for push branch outcome totality
    - **Property 18: Push branch outcome is a total function of the pending queue and the push response**
    - **Validates: Requirements 9.2, 9.3, 10.4, 11.1, 11.2, 11.3, 11.4, 11.6**
    - File: `src/sync/__tests__/syncCycleRunner.property18.test.ts` (mocked `SyncHttpClient`)

- [x] 10. Implement Sync_Cycle_Runner pull branch
  - [x] 10.1 Implement `runPullBranch` per the design's pull outcome table
    - Always build URL via `buildPullUrl(backendBaseUrl + '/api/v1/sync/pull', loadLastPulledAt())`; attach auth header via Auth_Interceptor
    - Handle: no-session-available (skip pull, unmodified `last_pulled_at`, no rollback), HTTP 200 → `applyPullChanges`, HTTP 401 `"Token expirado"` → one refresh + one retry, HTTP 500 and network error → unmodified `last_pulled_at`, no rollback, no throw
    - Wire `runPushBranch`/`runPullBranch` together in `createSyncCycleRunner`'s returned `runSyncCycle`
    - _Requirements: 9.4, 9.5, 10.1, 10.5, 11.2, 11.3, 11.5, 11.7_

  - [x]* 10.2 Write property test for pull branch outcome totality
    - **Property 19: Pull branch outcome is a total function of the cursor and the pull response**
    - **Validates: Requirements 9.4, 9.5, 10.5, 11.2, 11.3, 11.5, 11.7**
    - File: `src/sync/__tests__/syncCycleRunner.property19.test.ts` (mocked `SyncHttpClient`)

  - [x]* 10.3 Write property test for single Authorization header attachment at dispatch time
    - **Property 20: Every push and pull request carries exactly one Authorization header attached at dispatch time**
    - **Validates: Requirements 10.1**
    - File: `src/sync/__tests__/syncCycleRunner.property20.test.ts` (mocked `SyncHttpClient`)

  - [x]* 10.4 Write structural test for single Backend_Base_URL read site
    - Assert `backendBaseUrl` is read from `EnvConfig` in exactly one construction file (`syncCycleRunner.ts`) and injected via `deps`, never re-read from `process.env` elsewhere
    - _Requirements: 2.4, 2.5_

- [x] 11. Checkpoint - Ensure all sync-layer tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 12. Implement App_Navigator
  - [x] 12.1 Create `src/navigation/AppNavigator.tsx` with `RootStackParamList` and the `AppNavigator` component
    - Use `@react-navigation/native` + `@react-navigation/native-stack`; add these and `react-native-screens`, `react-native-safe-area-context` as dependencies
    - Implement `loading` → `restoreSession()` → `auth`/`authenticated` phase machine; `.catch` and non-`'dashboard'` results route to `auth`
    - Define four uniquely named routes: `Auth`, `Dashboard`, `WorkoutCreator`, `ActiveSession`
    - _Requirements: 5.1, 5.2, 6.1, 6.2, 6.3, 6.4, 6.7_

  - [x]* 12.2 Write property test for bootstrap navigation routing totality
    - **Property 9: Bootstrap navigation routing is a total function of restoreSession's outcome**
    - **Validates: Requirements 6.3, 6.4, 6.7**
    - File: `src/navigation/__tests__/AppNavigator.property9.test.ts`

  - [x]* 12.3 Write property test for Auth_Screen unreachability while a session is present
    - **Property 17: Auth_Screen is unreachable via in-app navigation while a session is present**
    - **Validates: Requirements 8.6**
    - File: `src/navigation/__tests__/AppNavigator.property17.test.ts`

  - [x]* 12.4 Write structural test for unique, non-duplicate route names
    - Assert exactly four uniquely named routes with no duplicates
    - _Requirements: 5.2_

- [x] 13. Add the two Dashboard callback props (Criterion 14.5 exception)
  - [x] 13.1 Extend `DashboardScreenProps` in `src/screens/DashboardScreen/DashboardScreen.tsx` with `onStartSession: () => void` and `onLogout: () => void` only
    - Wire an existing button's `onPress` to invoke each callback; make no other rendering/logic change; do not modify existing `DashboardScreen` test file beyond what's needed to satisfy the new required props in its default test props
    - _Requirements: 14.5_

  - [x]* 13.2 Write structural test confirming Dashboard_Screen's interface diff is limited to the two new callbacks
    - Assert no other member of `DashboardScreenProps` was added/removed/renamed/changed, and that `AuthScreen`, `WorkoutCreatorScreen`, `ActiveSessionScreen` interfaces are untouched
    - _Requirements: 14.3, 14.4, 14.5_

- [x] 14. Implement Screen_Containers
  - [x] 14.1 Create `src/navigation/containers/AuthScreenContainer.tsx`
    - Supply `isOnline` (NetInfo), `isLoading`/`error` (local state around `authManager.signIn()`), `onSubmit`; call `sessionStore.set(...)` on success
    - _Requirements: 5.3, 6.5, 6.6, 6.8_

  - [x]* 14.2 Write property test for sign-in navigation routing totality
    - **Property 10: Sign-in navigation routing is a total function of signIn's outcome**
    - **Validates: Requirements 6.5, 6.6, 6.8**
    - File: `src/navigation/__tests__/AppNavigator.property10.test.ts`

  - [x] 14.3 Create `src/navigation/containers/DashboardScreenContainer.tsx`
    - Supply `isOnline` (NetInfo), `isLoading`/`workouts` (`useObserveDashboard`), `syncStatus` (`useSyncStatus` hook over `syncEngine.isCycleInProgress`/`cyclesCompleted`/queue length), `onCreateWorkout`/`onStartSession` (navigation), `onLogout` (`Logout_Manager.requestLogout()`)
    - Ignore additional logout triggers while a call is pending; surface a transient error indication on reject/throw without touching local state otherwise
    - _Requirements: 5.3, 7.5, 7.6, 7.7, 7.8, 8.1, 8.5_

  - [x]* 14.4 Write property test for logout navigation/state-preservation totality
    - **Property 14: Logout navigation and state preservation is a total function of requestLogout's outcome**
    - **Validates: Requirements 7.5, 7.6, 7.7**
    - File: `src/navigation/__tests__/DashboardScreenContainer.property14.test.ts`

  - [x]* 14.5 Write property test for concurrent logout trigger collapsing
    - **Property 15: Concurrent logout triggers collapse to a single call**
    - **Validates: Requirements 7.8**
    - File: `src/navigation/__tests__/DashboardScreenContainer.property15.test.ts`

  - [x] 14.6 Create `src/navigation/containers/WorkoutCreatorScreenContainer.tsx`
    - Supply `isLoading`/`exercises` (`useObserveExerciseCatalog`), `error`, `onSave` (`saveWorkoutWithExercises`); navigate back on success, stay + show error + preserve entered data on failure
    - _Requirements: 5.3, 8.2, 8.3, 8.4_

  - [x]* 14.7 Write property test for workout save navigation/error/data-preservation totality
    - **Property 16: Workout save navigation, error display, and data preservation is a total function of persistence outcome**
    - **Validates: Requirements 8.2, 8.3, 8.4**
    - File: `src/navigation/__tests__/WorkoutCreatorScreenContainer.property16.test.ts`

  - [x] 14.8 Create `src/navigation/containers/ActiveSessionScreenContainer.tsx`
    - Supply `session`/`loggedSets`/`totalVolume` (`useObserveActiveSession` keyed by `route.params.sessionId`), `onLogSet` (`sessionLifecycle.createLoggedSet` + `persistLoggedSetWithIsolation`)
    - _Requirements: 5.3_

  - [x]* 14.9 Write per-container example tests asserting live (non-hardcoded) prop sourcing
    - One example test per container asserting the supplied prop value changes with the underlying source rather than being a static stub
    - _Requirements: 5.3_

  - [x] 14.10 Wire the four Screen_Containers into `AppNavigator`'s `Stack.Screen` render props
    - _Requirements: 5.2, 5.3_

- [x] 15. Checkpoint - Ensure all navigation-layer tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 16. Wire the Bootstrap_Sequence in App.tsx
  - [x] 16.1 Replace `App.tsx`'s placeholder content with the full Bootstrap_Sequence
    - Call `validateEnvConfig()`; on `{valid:false}` render `StartupErrorScreen` listing `offending` names and stop before constructing any client
    - On `{valid:true}`: construct `Supabase_Client`, the four auth adapters, `Session_Store`, `AuthManager`, `AuthInterceptor`, `Sync_Cycle_Runner`, `SyncEngine`, `Logout_Manager` (injecting the three logout port adapters from task 7); render `AppNavigator`
    - _Requirements: 1.6, 2.3, 2.4, 3.1, 3.5, 4.5, 4.6, 5.4, 7.4, 9.1, 10.3_

  - [x] 16.2 Create the trivial `StartupErrorScreen` presentational component
    - Lists every offending variable name; renders in place of the navigator on invalid env config
    - _Requirements: 1.6_

  - [x]* 16.3 Write one-shot wiring tests for the Bootstrap_Sequence
    - Assert `AuthManager`/`AuthInterceptor`/`LogoutManager`/`SyncEngine` are constructed with the correct concrete adapters; assert `App.tsx` no longer renders the placeholder; assert loading state renders while `restoreSession()` is pending
    - _Requirements: 3.5, 4.5, 4.6, 5.4, 6.1, 6.2, 7.4, 9.1, 10.3_

- [x] 17. Implement backend migration for `users.email` nullability
  - [x] 17.1 Create `gymnight/backend/alembic/versions/007_make_users_email_nullable.py`
    - `upgrade()`: `op.alter_column("users", "email", nullable=True)`; `downgrade()`: revert to `nullable=False`
    - Do not modify the `User` SQLAlchemy model, `UserProfileCreate` schema, or `POST /users` route handler
    - _Requirements: 12.1, 12.2, 12.5_

  - [x]* 17.2 Write a structural test on the migration script
    - Static inspection asserting only `nullable=True` is changed on `users.email` (no type/default/index change)
    - _Requirements: 12.1, 12.2_

  - [x]* 17.3 Write backend integration tests against a migrated test database
    - `POST /users` with omitted/null `email` and with a real `email` value, asserting HTTP 201 and no `IntegrityError` in both cases; assert the column accepts `NULL` post-migration and that type/default/unique index are otherwise unchanged
    - _Requirements: 12.3, 12.4, 12.5_

- [x] 18. Checkpoint - Ensure all backend tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 19. End-to-end validation (Physical Device Flow)
  - [ ] 19.1 Produce a documented/scripted end-to-end run of the full flow (sign-up/sign-in, profile creation via `POST /users`, workout creation, active session logging, one push-then-pull sync cycle) against a locally running, migrated Backend_API
    - **Prerequisites:**
      1. Android device connected via USB: `adb devices` lists device
      2. Backend running: `cd gymnight/backend && uvicorn app.main:app --host 0.0.0.0 --port 8000`
      3. Frontend deployed on device: `cd gymnight/frontend && npx expo run:android` (app running on physical device)
      4. Device on same Wi-Fi as dev machine (192.168.0.102)
    - Halt and report the failing step on any HTTP 4xx/5xx or unexpected-data outcome; assert `GET /api/v1/sync/pull` and `POST /api/v1/sync/push` return 2xx with the JWT-authenticated user's own data during the run
    - _Requirements: 13.1, 13.2, 13.3, 13.4_

  - [ ]* 19.2 Write structural "no modification" verification for Requirement 14
    - File-diff/hash check confirming Auth_Screen, Workout_Creator_Screen, Active_Session_Screen files, their tests, and all of `src/designSystem/**` are byte-identical to their pre-integration state; confirm Dashboard_Screen's diff is limited per task 13.2
    - _Requirements: 14.1, 14.2, 14.3, 14.4_

- [ ] 20. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Environment Configuration (Physical Device via USB)

**Network Setup:**
- Development machine IP: **192.168.0.102** (primary), 172.17.0.1 (fallback)
- Physical device: Connected via USB, same Wi-Fi network as dev machine
- Backend: FastAPI running locally, accessible at `http://192.168.0.102:8000`
- Frontend API calls: Point to `http://192.168.0.102:8000` (NOT localhost or 10.0.2.2)

**Build & Execution Flow:**
1. Ensure physical Android device is connected via USB: `adb devices`
2. Start backend: `cd gymnight/backend && uvicorn app.main:app --host 0.0.0.0 --port 8000`
3. Build & run frontend on device: `cd gymnight/frontend && npx expo run:android`
   - Expo will detect the connected USB device and deploy directly
   - Metro bundler will start and hot-reload on file changes

**Variable Validation:**
- `EXPO_PUBLIC_BACKEND_BASE_URL` must resolve to `http://192.168.0.102:8000` at runtime
- Env validation (task 1.1) enforces well-formedness but does NOT resolve hostnames
- No localhost/127.0.0.1/10.0.2.2 references allowed in frontend config

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP; they are not implemented by the coding agent per the "test sub-tasks are optional" convention, except where explicitly listed as a required structural/example test.
- Property tests (Properties 1–21) use fast-check with `numRuns: 100`, one file per property under `__tests__/`, tagged `Feature: frontend-backend-integration, Property N: {property text}`, mirroring `src/auth/__tests__/AuthManager.property22.test.ts`.
- No new backend (Hypothesis) property tests are added; Requirements 12 and 13 are covered by structural checks and integration/end-to-end tests only, per the design's Testing Strategy.
- Requirement 14's "no redesign" constraint is enforced throughout by construction (new files only, no edits to screens/design system) and verified explicitly in tasks 13.2 and 19.2.
- Checkpoints are placed after each major layer (auth, sync, navigation, backend, final) to catch integration issues early.
- **Physical device only**: No Android emulator support. All builds target USB-connected physical devices.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "17.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "1.4", "2.1", "17.2", "17.3"] },
    { "id": 2, "tasks": ["2.2", "3.1", "4.1", "5.1"] },
    { "id": 3, "tasks": ["3.2", "3.3", "3.4", "4.2", "5.2", "5.3", "6.1"] },
    { "id": 4, "tasks": ["6.2"] },
    { "id": 5, "tasks": ["6.3", "6.4", "7.1", "7.2", "7.3"] },
    { "id": 6, "tasks": ["7.4", "7.5", "7.6", "7.7", "9.1"] },
    { "id": 7, "tasks": ["9.2"] },
    { "id": 8, "tasks": ["9.3", "10.1"] },
    { "id": 9, "tasks": ["10.2", "10.3", "10.4", "12.1", "13.1"] },
    { "id": 10, "tasks": ["12.2", "12.3", "12.4", "13.2", "14.1", "14.3", "14.6", "14.8"] },
    { "id": 11, "tasks": ["14.2", "14.4", "14.5", "14.7", "14.9", "14.10"] },
    { "id": 12, "tasks": ["16.1"] },
    { "id": 13, "tasks": ["16.2", "16.3"] },
    { "id": 14, "tasks": ["19.1"] },
    { "id": 15, "tasks": ["19.2"] }
  ]
}
```
