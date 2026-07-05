# Requirements Document

## Introduction

Este documento especifica os requisitos para conectar de fato o frontend (Expo/React Native) do GymNight Mobile ao backend (FastAPI), e para montar a navegação real entre as telas já implementadas (Auth_Screen, Dashboard_Screen, Workout_Creator_Screen, Active_Session_Screen). Hoje o aplicativo builda e roda no emulador, mas permanece travado em `App.tsx` numa tela placeholder estática, porque nenhuma das peças já construídas e testadas (Auth_Manager, Secure_Storage, Sync_Engine, WatermelonDB, telas) foi instanciada ou ligada entre si em tempo de execução.

Este documento **não redesenha** a lógica interna de nenhuma tela, nem o design system, nem os contratos já definidos e testados dos módulos `src/auth/*` e `src/sync/*` (Auth_Manager, Secure_Storage, Auth_Interceptor, Token_Refresh_Coordinator, Logout_Manager, Sync_Engine, syncAdapters, pullRequest, pullApply). O escopo é exclusivamente de integração ("fiação"): instanciar dependências concretas que hoje só existem como interfaces injetáveis ou stubs padrão, configurar variáveis de ambiente, adicionar uma biblioteca de navegação, montar a árvore de telas real, e ligar o ciclo de sincronização aos endpoints reais do backend.

O documento também trata explicitamente de um débito técnico do backend identificado nesta integração: a coluna `users.email` no Postgres é `NOT NULL UNIQUE`, mas o model `User` (SQLAlchemy) não possui mais o campo `email` e `POST /users` nunca o preenche. Sem correção, a criação de perfil após cadastro real via Supabase Auth falha contra um banco Postgres real, o que bloqueia a validação ponta a ponta exigida por este documento. Este documento resolve essa ambiguidade adotando a correção como parte do próprio escopo (ver Requirement 12), em vez de declará-la como dependência bloqueante externa, pois sem essa correção o Requirement 13 (validação ponta a ponta) não pode ser cumprido.

## Glossary

- **Mobile_App**: A aplicação React Native (Expo SDK 52 + TypeScript) do GymNight, localizada em `gymnight/frontend`.
- **Backend_API**: A aplicação FastAPI do GymNight, localizada em `gymnight/backend`, expondo `/users`, `/health`, `/admin`, e o Sync_Router.
- **Env_Config**: O mecanismo de leitura de variáveis de ambiente do Mobile_App em tempo de build/execução, usando o prefixo `EXPO_PUBLIC_` do Expo (exposto via `process.env.EXPO_PUBLIC_*`) mais um arquivo `.env` local não versionado.
- **Supabase_URL**: O valor da variável de ambiente `EXPO_PUBLIC_SUPABASE_URL`, correspondente à URL do projeto Supabase.
- **Supabase_Anon_Key**: O valor da variável de ambiente `EXPO_PUBLIC_SUPABASE_ANON_KEY`, a chave anônima pública do projeto Supabase.
- **Backend_Base_URL**: O valor da variável de ambiente `EXPO_PUBLIC_BACKEND_BASE_URL`, correspondente à URL base do Backend_API (ex.: `http://localhost:8000`) usada para montar as URLs de `/api/v1/sync/pull`, `/api/v1/sync/push` e `/users`.
- **Supabase_Client**: A instância real criada por `createClient(Supabase_URL, Supabase_Anon_Key)` da biblioteca `@supabase/supabase-js`, único ponto do Mobile_App autorizado a chamar operações de autenticação do Supabase.
- **Auth_Manager**: A classe já implementada em `src/auth/AuthManager.ts`, responsável por `signIn()` e `restoreSession()`, que recebe via injeção de dependência um `SupabaseAuthClient`, um `SecureStoragePort`, um `TokenValidator` e um `SessionRefresher`.
- **Session**: Estrutura `{ access_token, refresh_token, user_id }` definida em `src/auth/SecureStorage.ts`.
- **Secure_Storage**: O módulo `src/auth/SecureStorage.ts`, que persiste a Session usando `expo-secure-store`.
- **Token_Validator**: A implementação da interface `TokenValidator` (`isExpired(accessToken)`) injetada no Auth_Manager, responsável por decidir se o `access_token` armazenado está expirado.
- **Session_Refresher**: A implementação da interface `SessionRefresher` (`refresh(refreshToken)`) injetada no Auth_Manager, responsável por obter uma nova Session junto ao Supabase_Client quando o `access_token` expira.
- **Auth_Interceptor**: O módulo já implementado em `src/auth/AuthInterceptor.ts`, responsável por anexar o header `Authorization: Bearer <access_token>` às chamadas do Sync_Engine.
- **Logout_Manager**: A classe já implementada em `src/auth/LogoutManager.ts`, que recebe via injeção de dependência um `SupabaseLogoutPort`, um `LogoutStoragePort` e um `LogoutWipePort`.
- **Sync_Engine**: A classe já implementada em `src/sync/SyncEngine.ts`, que recebe via injeção de dependência um `SyncCycleRunner` (`() => Promise<void>`) no construtor e expõe `requestSyncCycle()`.
- **Sync_Cycle_Runner**: A implementação concreta do tipo `SyncCycleRunner` a ser criada por este documento, responsável por executar, dentro de um único ciclo, um push contra `POST /api/v1/sync/push` seguido de um pull contra `GET /api/v1/sync/pull`, reutilizando `buildPushPayload`, `markRecordsAsSynced`, `quarantineRejectedPayload`, `buildPullUrl` e `applyPullChanges` já implementados em `src/sync/`.
- **Sync_Router**: Os endpoints `GET /api/v1/sync/pull` e `POST /api/v1/sync/push` do Backend_API, montados com prefixo `/api/v1`.
- **Navigation_Library**: A biblioteca `@react-navigation/native` (com `@react-navigation/native-stack` e as dependências nativas `react-native-screens` e `react-native-safe-area-context`), adicionada por este documento ao Mobile_App para permitir navegação real entre telas.
- **App_Navigator**: O componente raiz de navegação a ser criado por este documento, responsável por decidir, a cada mudança de estado de autenticação, se a pilha de navegação ativa é a de autenticação (Auth_Screen) ou a autenticada (Dashboard_Screen, Workout_Creator_Screen, Active_Session_Screen).
- **Bootstrap_Sequence**: A sequência de inicialização do Mobile_App (a partir de `App.tsx`) que, na ordem, instancia o Supabase_Client, instancia o Auth_Manager e o Sync_Engine com suas dependências reais, e invoca `Auth_Manager.restoreSession()` antes de renderizar o App_Navigator.
- **Auth_Screen**, **Dashboard_Screen**, **Workout_Creator_Screen**, **Active_Session_Screen**: As telas já implementadas em `src/screens/`, recebidas como componentes puros controlados por props (sem navegação própria e sem leitura de estado global).
- **Screen_Container**: Um componente novo, criado por este documento para cada tela, responsável por fornecer a essa tela as props que ela declara em sua interface pública (ex.: `AuthScreenProps`, `DashboardScreenProps`), obtidas de Reactive_Query, do Sync_Engine, do Auth_Manager ou de callbacks de navegação — sem alterar a tela em si.
- **Users_Email_Constraint**: O débito técnico identificado no Backend_API pelo qual a coluna `users.email` no Postgres é `NOT NULL UNIQUE`, mas o model SQLAlchemy `User` não define esse campo e `POST /users` nunca o popula.

## Requirements

### Pilar A — Configuração de Ambiente e Segredos

### Requirement 1: Variáveis de Ambiente do Frontend

**User Story:** Como desenvolvedor do GymNight, quero configurar a URL e a chave do Supabase e a URL do backend via variáveis de ambiente, para que o Mobile_App possa se conectar a diferentes ambientes (desenvolvimento, produção) sem alterar código-fonte.

#### Acceptance Criteria

1. WHEN the Mobile_App starts the Bootstrap_Sequence, THE Mobile_App SHALL read Supabase_URL from the environment variable `EXPO_PUBLIC_SUPABASE_URL` via Env_Config.
2. WHEN the Mobile_App starts the Bootstrap_Sequence, THE Mobile_App SHALL read Supabase_Anon_Key from the environment variable `EXPO_PUBLIC_SUPABASE_ANON_KEY` via Env_Config.
3. WHEN the Mobile_App starts the Bootstrap_Sequence, THE Mobile_App SHALL read Backend_Base_URL from the environment variable `EXPO_PUBLIC_BACKEND_BASE_URL` via Env_Config.
4. THE Mobile_App repository SHALL include an `.env.example` file at `gymnight/frontend/.env.example` listing `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, and `EXPO_PUBLIC_BACKEND_BASE_URL`, each assigned a non-functional placeholder value that does not correspond to a real, working Supabase project or backend endpoint.
5. THE Mobile_App SHALL exclude any local `.env` file containing real Supabase_URL, Supabase_Anon_Key, or Backend_Base_URL values from version control.
6. IF the Mobile_App starts the Bootstrap_Sequence and any of `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, or `EXPO_PUBLIC_BACKEND_BASE_URL` is missing, an empty string, or a string containing only whitespace characters, OR `EXPO_PUBLIC_SUPABASE_URL` or `EXPO_PUBLIC_BACKEND_BASE_URL` is set to a value that is not a syntactically valid absolute URL, THEN THE Mobile_App SHALL halt the Bootstrap_Sequence before rendering the App_Navigator and SHALL render a startup error screen naming every environment variable that is missing, empty, whitespace-only, or invalid.

### Requirement 2: Proibição de Segredos Hardcoded

**User Story:** Como desenvolvedor do GymNight, quero impedir que a chave do Supabase ou a URL do backend sejam escritas diretamente no código-fonte, para que a rotação de credenciais não exija alterar e recompilar o app.

#### Acceptance Criteria

1. THE Mobile_App source tree SHALL NOT contain a literal Supabase_URL, Supabase_Anon_Key, or Backend_Base_URL value inside any `.ts`, `.tsx`, `.js`, `.jsx`, or `.json` file, where "literal" includes the value written as plain text, string-concatenated fragments, or Base64/URL-encoded forms.
2. THE Mobile_App SHALL reference Supabase_URL, Supabase_Anon_Key, and Backend_Base_URL exclusively through Env_Config.
3. THE Mobile_App SHALL construct the Supabase_Client in exactly one source file, reading Supabase_URL and Supabase_Anon_Key from Env_Config only at that construction point.
4. THE Mobile_App SHALL construct the Sync_Cycle_Runner in exactly one source file, reading Backend_Base_URL from Env_Config only at that construction point.
5. THE Mobile_App source tree SHALL NOT contain any read of Env_Config for Supabase_URL, Supabase_Anon_Key, or Backend_Base_URL outside the Supabase_Client construction file and the Sync_Cycle_Runner construction file.

---

### Pilar B — Cliente Supabase Real e Renovação de Token

### Requirement 3: Instanciação do Cliente Supabase Real

**User Story:** Como desenvolvedor do GymNight, quero uma instância real do cliente Supabase, para que o Auth_Manager já implementado possa autenticar usuários de verdade em vez de depender de mocks de teste.

#### Acceptance Criteria

1. WHEN the Bootstrap_Sequence executes, THE Mobile_App SHALL create exactly one Supabase_Client instance using `createClient(Supabase_URL, Supabase_Anon_Key)` from `@supabase/supabase-js`.
2. WHEN the Supabase_Client's `auth.signInWithPassword` call succeeds, THE Mobile_App's `SupabaseAuthClient` implementation (defined in `src/auth/AuthManager.ts`) SHALL map the response to the interface's success shape, populating the session's user id, email, access_token, and refresh_token from the corresponding fields of the Supabase response, without modifying the `SupabaseAuthClient` interface itself.
3. IF the Supabase_Client's `auth.signInWithPassword` call resolves with an error (e.g., invalid credentials), THEN THE Mobile_App's `SupabaseAuthClient` implementation SHALL map that error to the interface's declared error shape.
4. IF the Supabase_Client's `auth.signInWithPassword` call throws an exception or its returned promise rejects, THEN THE Mobile_App's `SupabaseAuthClient` implementation SHALL catch that failure and convert it to the interface's declared error shape, so that the failure never propagates as an uncaught exception.
5. WHEN the Bootstrap_Sequence executes, THE Mobile_App SHALL inject the Supabase_Client-backed `SupabaseAuthClient` implementation into the Auth_Manager constructor.

### Requirement 4: Validação Real de Expiração e Renovação de Token

**User Story:** Como usuário do GymNight, quero que o app renove minha sessão automaticamente usando o Supabase real, para que eu permaneça autenticado sem precisar entender que existe um token por trás.

#### Acceptance Criteria

1. THE Mobile_App SHALL implement the `TokenValidator` interface defined in `src/auth/AuthManager.ts` by decoding the JWT `access_token` and comparing its `exp` claim (a Unix timestamp in seconds) against the current time, returning `true` from `isExpired` when the current time is greater than or equal to the `exp` claim, without relying on the Auth_Manager's default `isExpired: () => false` stub in production.
2. IF the JWT `access_token` cannot be decoded or its payload does not contain an `exp` claim, THEN THE Mobile_App's Token_Validator SHALL treat the token as expired and return `true` from `isExpired`.
3. THE Mobile_App SHALL implement the `SessionRefresher` interface defined in `src/auth/AuthManager.ts` using the Supabase_Client's `auth.refreshSession` method, mapping a successful response (containing a non-null `session`) to the `SessionRefresher` success shape carrying the new `access_token`, `refresh_token`, and `exp`, without relying on the Auth_Manager's default stub (which always returns an error) in production.
4. IF the Supabase_Client's `auth.refreshSession` call returns an error or a `null` session, THEN THE Mobile_App's Session_Refresher SHALL return the `SessionRefresher` error shape and SHALL NOT update the stored session.
5. WHEN the Bootstrap_Sequence executes, THE Mobile_App SHALL inject the JWT-based Token_Validator and the Supabase_Client-backed Session_Refresher into the Auth_Manager constructor.
6. WHILE the Mobile_App has a sync request pending an HTTP 401 retry per the Token_Refresh_Coordinator contract already implemented in `src/auth/TokenRefreshCoordinator.ts`, THE Mobile_App SHALL route that refresh request through the same Session_Refresher implementation used by the Auth_Manager, so that exactly one refresh mechanism exists in the Mobile_App.
7. WHEN the Session_Refresher successfully refreshes the session, THE Mobile_App SHALL persist the new `access_token`, `refresh_token`, and `exp` and SHALL propagate the refreshed session to the SessionProvider so that subsequent reads reflect the updated session.

---

### Pilar C — Navegação Real Entre Telas

### Requirement 5: Biblioteca de Navegação e Estrutura de Rotas

**User Story:** Como usuário do GymNight, quero navegar entre as telas de autenticação, dashboard, criação de treino e sessão ativa, para que eu possa efetivamente usar o aplicativo em vez de ver uma tela estática.

#### Acceptance Criteria

1. THE Mobile_App SHALL depend on Navigation_Library as its exclusive mechanism for screen-to-screen navigation.
2. THE App_Navigator SHALL define a uniquely named, addressable route for each of Auth_Screen, Dashboard_Screen, Workout_Creator_Screen, and Active_Session_Screen, with no duplicate route names among them.
3. THE App_Navigator SHALL wrap each screen in a Screen_Container that supplies the props declared by that screen's public interface (`AuthScreenProps`, `DashboardScreenProps`, `WorkoutCreatorScreenProps`, `ActiveSessionProps`) using live values sourced from Reactive_Query, Sync_Engine, Auth_Manager, or navigation callbacks, without supplying static or hardcoded stub values and without altering the screen component itself.
4. THE Mobile_App SHALL replace the placeholder content of `App.tsx` with the Bootstrap_Sequence followed by the rendering of the App_Navigator.

### Requirement 6: Autologin via Sessão Persistida

**User Story:** Como usuário do GymNight, quero que o app me leve direto ao dashboard quando já estou autenticado, para que eu não precise fazer login a cada abertura do app.

#### Acceptance Criteria

1. WHEN the Bootstrap_Sequence executes, THE Mobile_App SHALL call `Auth_Manager.restoreSession()` before rendering any of Auth_Screen or Dashboard_Screen.
2. WHILE `Auth_Manager.restoreSession()` has not yet resolved, THE App_Navigator SHALL render a loading state instead of Auth_Screen or Dashboard_Screen.
3. WHEN `Auth_Manager.restoreSession()` resolves with `{ navigateTo: 'dashboard' }`, THE App_Navigator SHALL render the authenticated route stack starting at Dashboard_Screen.
4. WHEN `Auth_Manager.restoreSession()` resolves with `{ navigateTo: 'auth' }`, THE App_Navigator SHALL render Auth_Screen.
5. WHEN the Auth_Screen's `onSubmit` callback is invoked and `Auth_Manager.signIn()` resolves with `{ success: true, navigateTo: 'dashboard' }`, THE App_Navigator SHALL navigate to Dashboard_Screen.
6. WHEN the Auth_Screen's `onSubmit` callback is invoked and `Auth_Manager.signIn()` resolves with `{ success: false, error }`, THE Screen_Container for Auth_Screen SHALL pass that error's message to the Auth_Screen's `error` prop and SHALL keep the App_Navigator on Auth_Screen.
7. IF `Auth_Manager.restoreSession()` rejects, throws, or resolves with a `navigateTo` value other than `'dashboard'` or `'auth'`, THEN THE App_Navigator SHALL render Auth_Screen.
8. IF the Auth_Screen's `onSubmit` callback is invoked and `Auth_Manager.signIn()` rejects or throws, THEN THE Screen_Container for Auth_Screen SHALL pass an error message indicating the sign-in attempt failed to the Auth_Screen's `error` prop and SHALL keep the App_Navigator on Auth_Screen.

### Requirement 7: Fluxo de Logout com Navegação Real

**User Story:** Como usuário do GymNight, quero sair da minha conta a partir da tela de dashboard e ser levado de volta à tela de login, para que eu tenha controle explícito sobre encerrar minha sessão.

#### Acceptance Criteria

1. THE Mobile_App SHALL implement the `SupabaseLogoutPort` interface defined in `src/auth/LogoutManager.ts` using the Supabase_Client's `auth.signOut` method; IF that call throws or rejects, THEN THE implementation SHALL propagate the failure to the Logout_Manager rather than resolving successfully.
2. THE Mobile_App SHALL implement the `LogoutStoragePort` interface defined in `src/auth/LogoutManager.ts` using the `clearSession` function from `src/auth/SecureStorage.ts`; IF that call throws or rejects, THEN THE implementation SHALL propagate the failure to the Logout_Manager rather than resolving successfully.
3. THE Mobile_App SHALL implement the `LogoutWipePort` interface defined in `src/auth/LogoutManager.ts` by deleting all locally stored records across the six WatermelonDB syncable tables (`users`, `exercises`, `workouts`, `workout_exercises`, `workout_sessions`, `logged_sets`) and clearing the persisted `last_pulled_at` cursor from `src/sync/lastPulledAt.ts`; IF any of these operations throws or rejects, THEN THE implementation SHALL propagate the failure to the Logout_Manager rather than resolving successfully.
4. THE Mobile_App SHALL inject the three implementations from Criteria 7.1–7.3 into the Logout_Manager constructor during the Bootstrap_Sequence.
5. WHEN a user triggers logout from Dashboard_Screen and `Logout_Manager.requestLogout()` resolves with `{ outcome: 'completed' }`, THE App_Navigator SHALL navigate to Auth_Screen.
6. IF `Logout_Manager.requestLogout()` resolves with `{ outcome: 'aborted' }`, THEN THE App_Navigator SHALL remain on Dashboard_Screen without any navigation change, and THE session data, WatermelonDB records, and `last_pulled_at` cursor SHALL remain unmodified.
7. IF `Logout_Manager.requestLogout()` rejects or throws, THEN THE App_Navigator SHALL remain on Dashboard_Screen, THE Dashboard_Screen's Screen_Container SHALL surface an error indication, and THE session data, WatermelonDB records, and `last_pulled_at` cursor SHALL remain unmodified.
8. WHILE a `Logout_Manager.requestLogout()` call is already pending, THE Mobile_App SHALL ignore additional logout triggers from Dashboard_Screen until the pending call resolves or rejects.

### Requirement 8: Navegação do Fluxo de Treino

**User Story:** Como usuário do GymNight, quero ir do dashboard para a criação de um treino e para uma sessão ativa, para que eu consiga completar o fluxo principal do aplicativo.

#### Acceptance Criteria

1. WHEN the Dashboard_Screen's `onCreateWorkout` callback is invoked, THE App_Navigator SHALL navigate to Workout_Creator_Screen.
2. WHEN the Workout_Creator_Screen's `onSave` callback is invoked and the Workout is persisted successfully to WatermelonDB, THE App_Navigator SHALL navigate back to Dashboard_Screen.
3. IF the Workout_Creator_Screen's `onSave` callback is invoked and the Workout fails to persist to WatermelonDB, THEN THE App_Navigator SHALL NOT navigate away from Workout_Creator_Screen.
4. IF the Workout_Creator_Screen's `onSave` callback is invoked and the Workout fails to persist to WatermelonDB, THEN THE Workout_Creator_Screen SHALL display an error message indicating the save failed and SHALL preserve the entered Workout data.
5. WHEN the Dashboard_Screen's `onStartSession` callback is invoked, THE App_Navigator SHALL navigate to Active_Session_Screen.
6. WHILE an authenticated User_Session is present in memory, THE App_Navigator SHALL navigate directly between Dashboard_Screen, Workout_Creator_Screen, and Active_Session_Screen without displaying Auth_Screen.

---

### Pilar D — Sincronização Real com o Backend

### Requirement 9: Implementação do Ciclo Real de Sincronização

**User Story:** Como desenvolvedor do GymNight, quero que o Sync_Engine já implementado execute chamadas reais contra o backend, para que o app deixe de depender exclusivamente de mocks de teste para sincronizar dados.

#### Acceptance Criteria

1. THE Mobile_App SHALL implement Sync_Cycle_Runner as the function injected into the Sync_Engine constructor during the Bootstrap_Sequence.
2. WHEN Sync_Cycle_Runner executes, IF the Pending_Sync_Queue contains at least one record, THEN THE Sync_Cycle_Runner SHALL send an HTTP POST request to `<Backend_Base_URL>/api/v1/sync/push` with a body built by `buildPushPayload` from the Pending_Sync_Queue records currently stored in WatermelonDB, before issuing any pull request in the same cycle; IF the Pending_Sync_Queue is empty, THEN THE Sync_Cycle_Runner SHALL skip the push request and proceed directly to the pull step defined in Criterion 9.4.
3. WHEN the push request in Criterion 9.2 completes with HTTP 200 and `{ "status": "ok" }`, THE Sync_Cycle_Runner SHALL apply `markRecordsAsSynced` to exactly the records included in the `buildPushPayload` body sent in that request, identified by their WatermelonDB record IDs.
4. WHEN the push step in Criterion 9.2 reaches one of the terminating outcomes defined in Requirement 11 that permits the sync cycle to continue, THE Sync_Cycle_Runner SHALL send an HTTP GET request to the URL built by `buildPullUrl(<Backend_Base_URL>/api/v1/sync/pull, loadLastPulledAt())`.
5. WHEN the pull request in Criterion 9.4 completes with HTTP 200, THE Sync_Cycle_Runner SHALL apply the response using `applyPullChanges` from `src/sync/pullApply.ts`.

### Requirement 10: Autenticação JWT nas Chamadas de Sincronização

**User Story:** Como desenvolvedor do GymNight, quero que toda chamada de sincronização real inclua o JWT do usuário autenticado, para que o Sync_Router do backend consiga identificar o usuário e aplicar isolamento multi-tenant.

#### Acceptance Criteria

1. WHEN Sync_Cycle_Runner sends the push request described in Criterion 9.2 or the pull request described in Criterion 9.4, THE Sync_Cycle_Runner SHALL route that request through the Auth_Interceptor's `attachAuthHeader` method before dispatch.
2. THE Mobile_App SHALL implement the `SessionProvider` interface defined in `src/auth/AuthInterceptor.ts` by returning the in-memory Session most recently produced by `Auth_Manager.signIn()`, `Auth_Manager.restoreSession()`, or the Session_Refresher's successful refresh, and SHALL return null if no Session has ever been produced or if the most recent event was the logout described in Criterion 7.5.
3. THE Mobile_App SHALL inject the implementation from Criterion 10.2 into the Auth_Interceptor constructor during the Bootstrap_Sequence.
4. IF the Auth_Interceptor's `attachAuthHeader` throws because no Session is available while preparing the push request described in Criterion 9.2, THEN THE Sync_Cycle_Runner SHALL abort the synchronization cycle without sending the push request and SHALL leave the Pending_Sync_Queue unmodified.
5. IF the Auth_Interceptor's `attachAuthHeader` throws because no Session is available while preparing the pull request described in Criterion 9.4, THEN THE Sync_Cycle_Runner SHALL skip the pull request, SHALL leave `last_pulled_at` unmodified, and SHALL NOT reverse or roll back any push already applied under Criterion 9.3 during that synchronization cycle.

### Requirement 11: Tratamento de Respostas HTTP do Sync_Router

**User Story:** Como usuário do GymNight, quero que erros reais do backend durante a sincronização sejam tratados sem perda de dados, para que a integração real preserve as garantias já validadas com mocks.

#### Acceptance Criteria

1. IF the push request described in Criterion 9.2 receives an HTTP 403 response, THEN THE Sync_Cycle_Runner SHALL apply `quarantineRejectedPayload` to the entire push payload as a single unit rather than to individual records within it, and SHALL NOT retry that specific payload in the same cycle.
2. IF the push or pull request described in Criteria 9.2 or 9.4 receives an HTTP 401 response with the body message `"Token expirado"`, THEN THE Sync_Cycle_Runner SHALL trigger the Token_Refresh_Coordinator's `refresh` method using the Session_Refresher from Requirement 4.2, and SHALL retry the original request exactly once after a successful refresh.
3. IF the Token_Refresh_Coordinator's `refresh` method fails, or IF the retried request described in Criterion 2 receives another HTTP 401 response, THEN THE Sync_Cycle_Runner SHALL abort the sync cycle, SHALL leave the Pending_Sync_Queue and the persisted `last_pulled_at` unmodified, and SHALL return control to the Sync_Engine without throwing an unhandled exception.
4. IF the push request described in Criterion 9.2 fails due to a network error (timeout, connection refused, or no connectivity), THEN THE Sync_Cycle_Runner SHALL leave the Pending_Sync_Queue unmodified, SHALL NOT proceed to the pull step in that same cycle, and SHALL return control to the Sync_Engine without throwing an unhandled exception.
5. IF the pull request described in Criterion 9.4 fails due to a network error (timeout, connection refused, or no connectivity), THEN THE Sync_Cycle_Runner SHALL leave the persisted `last_pulled_at` unmodified, SHALL NOT reverse any push already applied in that same cycle, and SHALL return control to the Sync_Engine without throwing an unhandled exception.
6. IF the push request described in Criterion 9.2 receives an HTTP 500 response, THEN THE Sync_Cycle_Runner SHALL leave the corresponding records in the Pending_Sync_Queue and SHALL NOT proceed to the pull step in that same cycle.
7. IF the pull request described in Criterion 9.4 receives an HTTP 500 response, THEN THE Sync_Cycle_Runner SHALL leave the persisted `last_pulled_at` unmodified and SHALL NOT reverse any push already applied in that same cycle.

---

### Pilar E — Débito Técnico do Backend e Validação Ponta a Ponta

### Requirement 12: Correção da Restrição `users.email NOT NULL`

**User Story:** Como desenvolvedor do GymNight, quero remover a exigência de `email` na tabela `users` do Postgres, para que a criação real de perfil após cadastro no Supabase Auth não falhe contra o banco de dados.

#### Acceptance Criteria

1. THE Backend_API SHALL include a database migration that removes only the `NOT NULL` constraint on the `users` table's `email` column, and SHALL NOT change the column's data type, default value, or existing uniqueness constraint.
2. THE Backend_API's database migration for Criterion 12.1 SHALL preserve the `email` column and any existing data in it, and SHALL NOT drop the column.
3. WHEN `POST /users` is called with a `UserProfileCreate` payload that omits the `email` value (missing or null) against a Postgres database that has applied the migration from Criterion 12.1, THE Backend_API SHALL create the user profile with `email` set to `NULL` and SHALL NOT raise an `IntegrityError`.
4. WHEN `POST /users` is called with a valid `UserProfileCreate` payload that includes a non-null `email` value against a Postgres database that has applied the migration from Criterion 12.1, THE Backend_API SHALL create the user profile with that `email` value without raising an `IntegrityError`.
5. THE Backend_API SHALL apply the migration from Criterion 12.1 without requiring any change to the `User` SQLAlchemy model, the `UserProfileCreate` schema, or the `POST /users` route handler.

### Requirement 13: Validação Ponta a Ponta do Fluxo Completo

**User Story:** Como desenvolvedor do GymNight, quero validar o fluxo completo do app contra o backend real, para que eu tenha confiança de que a integração funciona fora de um ambiente de testes com mocks.

#### Acceptance Criteria

1. THE Mobile_App SHALL support running the complete flow — sign-up or sign-in via Supabase_Client, profile creation via `POST /users`, workout creation, active session logging, and a synchronization cycle via Sync_Cycle_Runner — against a Backend_API instance running locally with the migration from Requirement 12 applied, with each step completing with a success response (HTTP 2xx) and no unhandled error before the Mobile_App proceeds to the next step.
2. WHEN the end-to-end validation in Criterion 13.1 is executed, THE Backend_API SHALL respond to `GET /api/v1/sync/pull` and `POST /api/v1/sync/push` with an HTTP 2xx response containing the JWT-authenticated user's own data, and SHALL NOT respond to either request with an HTTP 401 or HTTP 500.
3. THE end-to-end validation in Criterion 13.1 SHALL include at least one full push-then-pull synchronization cycle in which data created on Mobile_App while offline is persisted and queryable in the Backend_API's Postgres database within 30 seconds after the device reconnects and Sync_Cycle_Runner completes the push operation.
4. IF any step of the end-to-end validation in Criterion 13.1 (sign-up or sign-in, profile creation, workout creation, session logging, or synchronization) returns an HTTP 4xx or HTTP 5xx response, or fails to produce the expected data, THEN the end-to-end validation SHALL be considered failed, SHALL halt without executing subsequent steps, and SHALL indicate which step failed.

---

### Pilar F — Restrição de Escopo

### Requirement 14: Não Redesenho de Telas e Design System

**User Story:** Como desenvolvedor do GymNight, quero garantir que a integração não altere a lógica interna das telas nem o design system, para que o trabalho já testado nessas camadas não seja invalidado ou duplicado.

#### Acceptance Criteria

1. THE Mobile_App integration work covered by this document SHALL NOT create, delete, or replace files, and SHALL NOT modify the internal implementation, rendering logic, or existing test files, of Auth_Screen, Dashboard_Screen, Workout_Creator_Screen, or Active_Session_Screen.
2. THE Mobile_App integration work covered by this document SHALL NOT create, delete, replace, or modify any file inside `src/designSystem/`.
3. THE Mobile_App integration work covered by this document SHALL NOT add, remove, or rename members of, and SHALL NOT change the signature or behavior of, the public interfaces (`SupabaseAuthClient`, `SecureStoragePort`, `TokenValidator`, `SessionRefresher`) already defined in `src/auth/AuthManager.ts`, the `SyncCycleRunner` type already defined in `src/sync/SyncEngine.ts`, or the ports already defined in `src/auth/LogoutManager.ts`.
4. IF a Screen_Container needs a prop value that a screen's existing interface does not yet expose, THEN THE Mobile_App integration work covered by this document SHALL leave that need unimplemented rather than modifying the screen's interface to accommodate it, except for the narrow exception defined in Criterion 14.5.
5. WHERE the Mobile_App integration work covered by this document needs to satisfy Requirement 7.5 (logout triggered from Dashboard_Screen) and Requirement 8.5 (navigation to Active_Session_Screen triggered from Dashboard_Screen), THE Mobile_App integration work MAY add exactly two new callback props, `onStartSession` and `onLogout`, to `DashboardScreenProps`, and SHALL NOT otherwise add, remove, rename, or change the signature of any other member of `DashboardScreenProps`; THE Mobile_App integration work SHALL NOT modify Dashboard_Screen's internal rendering logic or existing test files beyond adding invocation of the `onStartSession` and `onLogout` callback props; and THE Mobile_App integration work SHALL NOT modify the interface of Auth_Screen, Workout_Creator_Screen, or Active_Session_Screen under this exception.
