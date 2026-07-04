# Requirements Document

## Introduction

Este documento é a especificação técnica MASTER de implementação do frontend do GymNight Mobile: um aplicativo de treino offline-first construído em React Native (Expo SDK 57) + TypeScript, com WatermelonDB como banco local e Supabase Auth para autenticação. O backend FastAPI (SQLAlchemy + Alembic + PostgreSQL) já está implementado, testado e é tratado como fonte de verdade de contrato — os requisitos abaixo NÃO reabrem decisões de schema, rotas ou regras de propriedade multi-tenant já validadas no backend; eles especificam como o frontend deve consumir esse contrato corretamente.

O documento cobre cinco pilares: (1) arquitetura offline-first orientada a WatermelonDB como single source of truth, (2) autenticação via Supabase com renovação automática de sessão, (3) design system dark/neon com tokens centralizados, (4) telas e jornada do usuário (Auth, Dashboard, Workout Creator, Active Session) com seus estados de UI, e (5) estratégia de testes de componente com mock do banco local. Este documento define SOMENTE requisitos — nenhuma implementação de código é escopo desta fase.

## Glossary

- **Mobile_App**: A aplicação React Native (Expo SDK 57 + TypeScript) do GymNight, objeto desta especificação.
- **WatermelonDB**: Banco de dados local reativo baseado em SQLite usado pelo Mobile_App para persistência offline-first.
- **Single_Source_Of_Truth**: Princípio arquitetural pelo qual toda a UI lê o estado exclusivamente do WatermelonDB, sem estado duplicado em bibliotecas de gerenciamento de estado (ex: Zustand, Redux, Context de dados de domínio).
- **Reactive_Query**: Consulta ao WatermelonDB (via `observe()`/`withObservables` ou hook equivalente) que emite automaticamente novos valores para o componente React quando os registros observados são alterados localmente.
- **_status**: Coluna de metadados do WatermelonDB em cada registro sincronizável, com valores `created`, `updated`, `synced` ou `deleted`, usada para determinar o que precisa ser enviado ao servidor.
- **_changed**: Coluna de metadados do WatermelonDB que lista os nomes dos campos alterados desde a última sincronização, usada pelo protocolo de Push.
- **Sync_Engine**: Módulo do Mobile_App responsável por orquestrar as chamadas de sincronização (`pull` e `push`) do WatermelonDB contra o backend, incluindo agendamento, retries e persistência do `last_pulled_at`.
- **Pending_Sync_Queue**: Conjunto de registros locais com `_status` igual a `created` ou `updated` que ainda não foram confirmados como persistidos no servidor.
- **Tombstone**: Registro de deleção retornado pelo backend no campo `deleted` da resposta de `pull`, indicando que um registro deve ser removido do WatermelonDB local.
- **Sync_Router**: Os endpoints de backend `GET /api/v1/sync/pull` e `POST /api/v1/sync/push`, cujo contrato de request/response é tratado como fixo por esta especificação.
- **last_pulled_at**: Timestamp Unix em milissegundos, persistido localmente pelo Sync_Engine, enviado como parâmetro de query no `pull` para obter apenas mudanças incrementais.
- **Network_Monitor**: Módulo do Mobile_App que utiliza a biblioteca NetInfo (ou equivalente) para detectar transições de conectividade (offline → online).
- **Auth_Manager**: Módulo do Mobile_App responsável por login, cadastro, persistência de sessão e renovação de token, utilizando exclusivamente `@supabase/supabase-js` para operações de autenticação (não para dados de domínio).
- **Session**: Estrutura retornada pelo Supabase Auth contendo `access_token` (JWT), `refresh_token` e metadados do usuário autenticado.
- **Secure_Storage**: Mecanismo de armazenamento criptografado no dispositivo (ex: Expo SecureStore / Keychain / Keystore) usado para persistir a Session.
- **Auth_Interceptor**: Componente do Sync_Engine responsável por anexar o header `Authorization: Bearer <access_token>` a toda chamada HTTP dirigida ao Sync_Router.
- **Design_Token**: Valor de design centralizado (cor, espaçamento, tipografia, raio de borda) definido em um módulo único e consumido por referência nos componentes de UI, nunca declarado como valor literal (hardcoded) dentro de uma tela.
- **Primary_Text_Token**: Design_Token de cor usado para o texto principal (de maior destaque) sobre os fundos `background` e `surface`, distinto do token `secondary text`.
- **Design_Token_Module**: Módulo de código-fonte único que exporta todos os Design_Tokens do Mobile_App.
- **Epley_Formula**: Fórmula de estimativa de repetição máxima usada como `estimated_one_rm = weight * (1 + repetitions / 30)`, aplicada quando o cliente calcula o 1RM estimado de um LoggedSet localmente.
- **Volume**: Métrica calculada como a soma de `weight * repetitions` de todos os LoggedSets de uma WorkoutSession.
- **Freestyle_Session**: Uma WorkoutSession cujo campo `workout_id` é nulo, ou seja, criada sem vínculo a um Workout pré-definido.
- **Auth_Screen**: Tela de login e cadastro do Mobile_App.
- **Dashboard_Screen**: Tela inicial pós-login, exibindo o treino do dia, status de sincronização e estatísticas rápidas.
- **Workout_Creator_Screen**: Tela de criação e edição de Workouts e seus WorkoutExercises, a partir do catálogo de Exercises.
- **Active_Session_Screen**: Tela de execução de um treino em andamento, com cronômetro e registro instantâneo de LoggedSets.
- **UI_State**: Um dos quatro estados de exibição de uma tela ou seção de tela: `loading`, `offline`, `error` ou `empty`.
- **Sync_Status_Indicator**: Elemento de UI que comunica visualmente se o Mobile_App está `synced`, `syncing`, `pending` ou `offline`.
- **Mock_Database_Adapter**: Substituto de teste do adaptador SQLite do WatermelonDB, usado para executar testes de componente sem um banco de dados real.

## Requirements

### Pilar 1 — Arquitetura Offline-First

### Requirement 1: WatermelonDB como Single Source of Truth

**User Story:** Como desenvolvedor do GymNight, quero que toda a UI leia dados exclusivamente do WatermelonDB, para que não existam duas fontes de verdade divergentes sobre o mesmo dado de domínio.

#### Acceptance Criteria

1. THE Mobile_App SHALL read all domain data (users, exercises, workouts, workout_exercises, workout_sessions, logged_sets) exclusively from WatermelonDB collections.
2. THE Mobile_App SHALL NOT copy domain data retrieved from WatermelonDB as a stored value into a separate global state library (Zustand, Redux, or equivalent) for rendering purposes.
3. WHERE the Mobile_App uses a state management library, THE Mobile_App SHALL restrict its usage to non-domain UI state (e.g., form input drafts, navigation state, modal visibility).
4. THE Mobile_App SHALL bind every screen that displays domain data to a Reactive_Query.
5. WHEN a local WatermelonDB write affecting a bound Reactive_Query is committed, THE Mobile_App SHALL reflect the change in the corresponding screen within the same Reactive_Query emission cycle, without requiring a manual refresh action.
6. IF a Reactive_Query fails to initialize or emits an error, THEN THE Mobile_App SHALL display an `error` UI_State for the affected screen section, and WHILE that Reactive_Query remains in a failed or recovering (retrying) state, THE Mobile_App SHALL display only an `error` or `loading` UI_State for the affected screen section and SHALL NOT render stale or partial domain data as if it were current at any point during the failure or recovery attempt.
7. THE Mobile_App SHALL permit component-level derivations (filtering, sorting, or grouping) of data obtained from a Reactive_Query, provided such derivations are recomputed from the Reactive_Query's emissions and are never persisted as stored values outside of WatermelonDB.

### Requirement 2: Gravação Local Imediata

**User Story:** Como usuário do GymNight, quero que minhas ações (criar treino, registrar série) sejam salvas instantaneamente no dispositivo, para que eu possa continuar treinando mesmo sem conexão com a internet.

#### Acceptance Criteria

1. WHEN a user creates, updates, or deletes a domain record through any screen, THE Mobile_App SHALL persist the change to WatermelonDB before displaying any confirmation to the user.
2. WHEN a domain record is created, updated, or deleted locally, THE Mobile_App SHALL set the record's `_status` field to `created`, `updated`, or `deleted` respectively, following WatermelonDB's default change-tracking behavior.
3. THE Mobile_App SHALL complete every local write operation (create, update, delete), measured from the moment the operation is invoked to the moment WatermelonDB confirms the change is committed to local storage, in under 100 milliseconds when running on a mid-tier reference device (minimum specification: quad-core CPU at 2.0 GHz or equivalent, 3 GB RAM, Android 10 or iOS 14 or later), independent of network connectivity.
4. IF a local write operation to WatermelonDB fails, THEN THE Mobile_App SHALL retain the record's prior persisted state without applying the partial change, SHALL display an error message indicating the write failure to the user, SHALL NOT report the action as successful, and SHALL NOT trigger any indicator of success, including navigation away from the current screen or a UI update that implies the action succeeded.

### Requirement 3: Monitoramento de Conectividade

**User Story:** Como usuário do GymNight, quero que o app detecte automaticamente quando minha conexão volta, para que meus dados sejam sincronizados sem eu precisar fazer nada manualmente.

#### Acceptance Criteria

1. WHILE the Mobile_App is in the foreground, THE Network_Monitor SHALL detect any change in the device's network connectivity state (online or offline, as reported by the device operating system) within 3 seconds of the change occurring.
2. WHEN the Network_Monitor detects a transition from offline to online that remains stable for at least 2 seconds, THE Sync_Engine SHALL automatically trigger a synchronization cycle (push followed by pull) without requiring user interaction.
3. WHILE the device is offline, THE Mobile_App SHALL execute all local create, update, and delete operations on WatermelonDB with the same success behavior as when online, persisting each operation locally and marking it for synchronization once connectivity is restored.
4. WHILE the device is offline, THE Sync_Status_Indicator SHALL display the `offline` state.
5. IF an automatically triggered synchronization cycle fails to complete, THEN THE Sync_Engine SHALL preserve all local unsynced data without loss.
6. IF an automatically triggered synchronization cycle fails to complete, THEN THE Sync_Status_Indicator SHALL display an error state indicating that synchronization did not complete.
7. WHILE an automatically triggered synchronization cycle is in progress, THE Sync_Status_Indicator SHALL display a `syncing` state.

### Requirement 4: Ciclo de Sincronização (Pull e Push)

**User Story:** Como desenvolvedor do GymNight, quero um ciclo de sincronização determinístico entre WatermelonDB e o Sync_Router, para que o estado local e o do servidor convirjam de forma previsível.

#### Acceptance Criteria

1. WHEN a synchronization cycle starts, THE Sync_Engine SHALL first execute a push of all Pending_Sync_Queue records, and SHALL execute a pull request only after the push reaches a terminal outcome (success, or a failure handled per Requirement 5).
2. IF the Sync_Engine has never successfully persisted a `last_pulled_at` value, THEN THE Sync_Engine SHALL execute the pull request against `GET /api/v1/sync/pull` without the `last_pulled_at` query parameter, treating it as a first synchronization cycle.
3. WHEN the Sync_Engine executes a pull request and a `last_pulled_at` value has been previously persisted, THE Sync_Engine SHALL send that value as the `last_pulled_at` query parameter to `GET /api/v1/sync/pull`.
4. WHEN the Sync_Engine executes a push request, THE Sync_Engine SHALL send the Pending_Sync_Queue records grouped by table in the `{ changes: { <table>: { created, updated, deleted } } }` format expected by `POST /api/v1/sync/push`.
5. WHEN a pull response is received with HTTP 200, THE Sync_Engine SHALL apply the returned `created`, `updated`, and `deleted` (Tombstone) changes to WatermelonDB and SHALL update the locally persisted `last_pulled_at` to the response's `timestamp` field only after all changes are applied successfully.
6. WHEN a push response is received with HTTP 200 and `{ "status": "ok" }`, THE Sync_Engine SHALL mark the previously pending records as `synced` in WatermelonDB.
7. WHILE the Mobile_App is in the foreground and the device is online, THE Sync_Engine SHALL trigger an automatic synchronization cycle every 30 seconds, in addition to the triggers defined in Requirement 3.2 and Requirement 6.
8. IF a new synchronization cycle is triggered (by the fixed interval in Criterion 4.7, a connectivity transition per Requirement 3.2, or a manual user action) while a previous synchronization cycle is still in progress, THEN THE Sync_Engine SHALL NOT start a second concurrent cycle and SHALL instead allow the in-progress cycle to complete before evaluating whether another cycle is needed.

### Requirement 5: Resiliência a Falhas de Sincronização

**User Story:** Como usuário do GymNight, quero que falhas de sincronização nunca causem perda dos meus dados de treino, para que eu confie no app mesmo em condições de rede instáveis.

#### Acceptance Criteria

1. IF a push or pull request fails due to a network error (timeout, connection refused, or no connectivity), THEN THE Sync_Engine SHALL leave all affected records in their current `_status` inside the Pending_Sync_Queue and SHALL retry the synchronization cycle, without an upper limit on retry attempts, on the next trigger defined in Requirement 3.2, Requirement 4.7, or a manual user action, without discarding any local record.
2. IF the Sync_Router returns HTTP 500 for a push request, THEN THE Sync_Engine SHALL keep the corresponding records in the Pending_Sync_Queue, SHALL cause the Sync_Status_Indicator to reflect an unresolved failure state (per Requirement 15), SHALL continue retrying the synchronization cycle on subsequent triggers, and SHALL NOT roll back the local write.
3. IF the Sync_Router returns HTTP 403 for a push request, THEN THE Sync_Engine SHALL stop retrying that specific request payload, SHALL preserve the rejected records and their `_status` in WatermelonDB without discarding their data, SHALL log the rejected record identifiers for diagnostic purposes, SHALL cause the Sync_Status_Indicator to reflect an unresolved failure state (per Requirement 15) for those records, and SHALL NOT discard unrelated pending records.
4. WHILE a synchronization cycle is in progress, THE Mobile_App SHALL continue to accept new local write operations on WatermelonDB without blocking the UI thread.
5. THE Sync_Engine SHALL treat push operations as safe to retry (relying on the Sync_Router's idempotent-insert behavior on duplicate IDs, per the backend contract), and SHALL resend a previously attempted push payload after a failure without producing duplicate records on the Sync_Router or in local WatermelonDB storage.
6. IF the Sync_Router returns HTTP 500 for a pull request, THEN THE Sync_Engine SHALL NOT update the locally persisted `last_pulled_at` value, SHALL cause the Sync_Status_Indicator to reflect an unresolved failure state (per Requirement 15), and SHALL retry the pull on the next synchronization trigger defined in Requirement 3.2, Requirement 4.7, or a manual user action.

### Requirement 6: Resolução de Conflitos

**User Story:** Como usuário do GymNight, quero que conflitos entre alterações locais e do servidor sejam resolvidos de forma previsível, para que meus dados não sejam sobrescritos silenciosamente de forma inconsistente.

#### Acceptance Criteria

1. WHEN the Sync_Engine's pull step returns an `updated` record whose `id` also exists in the local Pending_Sync_Queue as `updated`, THE Sync_Engine SHALL apply WatermelonDB's built-in conflict resolution (per-column merge based on `_changed`) rather than discarding either version wholesale, and SHALL keep the resulting merged record's `_status` as `updated` so the locally-changed columns are sent to the server on the next push.
2. WHEN a pull response includes a Tombstone for a record that also exists in the local Pending_Sync_Queue as `updated`, THE Sync_Engine SHALL delete the local record and SHALL discard the pending update for that record.
3. WHEN the Sync_Engine's pull step returns an `updated` or `created` record whose `id` matches a local record whose `_status` is `deleted`, THE Sync_Engine SHALL discard the incoming pull data for that record, SHALL keep the local record's `_status` as `deleted`, and SHALL include that record's deletion in the next push request so the server-side deletion is applied.
4. IF applying a pull response's changes to WatermelonDB raises an error that is not a transient network error (e.g., a schema mismatch, a malformed record payload, or an unexpected exception thrown by WatermelonDB's conflict-resolution step), THEN THE Sync_Engine SHALL abort applying that pull response, SHALL NOT partially apply any of the pull response's changes, SHALL NOT update `last_pulled_at`, and SHALL retry the pull on the next synchronization cycle.

---

### Pilar 2 — Autenticação e Refresh Token

### Requirement 7: Login e Cadastro via Supabase Auth

**User Story:** Como usuário do GymNight, quero criar uma conta ou entrar com minhas credenciais, para que eu possa acessar meus dados de treino de forma segura.

#### Acceptance Criteria

1. THE Auth_Manager SHALL perform user sign-up and sign-in exclusively through `@supabase/supabase-js` client methods.
2. THE Auth_Manager SHALL NOT implement custom password storage, hashing, or verification logic within the Mobile_App.
3. WHEN a sign-in or sign-up call to Supabase succeeds AND returns a Session, THE Auth_Manager SHALL persist the resulting Session to Secure_Storage before navigating away from the Auth_Screen.
4. IF a sign-up call to Supabase succeeds but does not return a Session (e.g., email confirmation pending), THEN THE Auth_Screen SHALL remain on the Auth_Screen and SHALL display a message instructing the user to confirm their email before signing in.
5. IF a sign-in or sign-up call to Supabase fails, whether due to a credential-rejection error returned by Supabase or a network-level failure (timeout, connection refused, or no connectivity) raised by the Supabase client, THEN THE Auth_Screen SHALL display the corresponding error message and SHALL remain on the Auth_Screen.
6. IF a sign-in or sign-up call to Supabase succeeds and returns a Session, but the subsequent write to Secure_Storage fails, THEN THE Auth_Manager SHALL NOT navigate away from the Auth_Screen, SHALL discard the in-memory Session, and THE Auth_Screen SHALL display an error message indicating that the session could not be saved on the device.

### Requirement 8: Persistência Segura de Sessão

**User Story:** Como usuário do GymNight, quero permanecer autenticado entre sessões de uso do app, para que eu não precise fazer login a cada vez que abro o app.

#### Acceptance Criteria

1. THE Auth_Manager SHALL store the `access_token` and `refresh_token` exclusively in Secure_Storage, and SHALL NOT store them in unencrypted storage (e.g., AsyncStorage, plain files) or in WatermelonDB.
2. WHEN the Mobile_App launches, THE Auth_Manager SHALL display a `loading` UI_State while attempting to restore the Session from Secure_Storage, before rendering the Auth_Screen or Dashboard_Screen.
3. IF a Session is successfully restored from Secure_Storage AND the stored `access_token` is not expired, THEN THE Auth_Manager SHALL navigate directly to the Dashboard_Screen without requiring the user to re-authenticate.
4. IF a Session is successfully restored from Secure_Storage AND the stored `access_token` is expired AND a `refresh_token` is present, THEN THE Auth_Manager SHALL attempt the token renewal flow defined in Requirement 10 before deciding whether to navigate to the Dashboard_Screen or the Auth_Screen.
5. IF no Session is found in Secure_Storage at launch, OR the stored Session data cannot be parsed as valid Session data, THEN THE Auth_Manager SHALL clear any unparseable data from Secure_Storage and SHALL navigate to the Auth_Screen.

### Requirement 9: Injeção de Token nas Chamadas de Sincronização

**User Story:** Como desenvolvedor do GymNight, quero que todas as chamadas de sincronização incluam automaticamente o token de acesso, para que eu não precise repetir essa lógica em cada chamada.

#### Acceptance Criteria

1. THE Auth_Interceptor SHALL attach exactly one `Authorization: Bearer <access_token>` header to every HTTP request made by the Sync_Engine to the Sync_Router.
2. THE Auth_Interceptor SHALL read the current `access_token` from the in-memory Session managed by the Auth_Manager at the time each request is dispatched, using the value set by the most recently completed sign-in (Requirement 7.3) or token refresh (Requirement 10.2), rather than a value captured before that update.
3. IF the Auth_Interceptor attempts to dispatch a sync request while the in-memory Session is null or absent (because no sign-in has occurred yet, or the Session was cleared per Requirement 11), THEN THE Sync_Engine SHALL skip the synchronization cycle, SHALL NOT send the request to the Sync_Router, SHALL leave the Pending_Sync_Queue unmodified, and SHALL retry the synchronization cycle on the next trigger defined in Requirement 3.2 or Requirement 4.7 once a Session becomes available.
4. WHILE the in-memory Session is present (not null or absent), THE Auth_Interceptor SHALL dispatch the sync request normally, attaching the current access_token per Criterion 9.2, such that for every sync request dispatch attempt, THE Auth_Interceptor SHALL always perform exactly one of these two defined actions — skip the synchronization cycle per Criterion 9.3, or dispatch the request normally per this Criterion — and SHALL NOT leave a sync request dispatch attempt in an undefined or unhandled intermediate state.
5. WHEN the in-memory Session transitions from null or absent to present, THE Sync_Engine SHALL process every record in the Pending_Sync_Queue on the immediately following synchronization cycle without artificial throttling, batching delay, or partial processing.

### Requirement 10: Renovação Automática de Token em Falha 401

**User Story:** Como usuário do GymNight, quero que o app renove minha sessão automaticamente quando o token expira, para que eu não perca meu progresso de sincronização nem seja deslogado sem necessidade.

#### Acceptance Criteria

1. IF a sync request receives an HTTP 401 response with the message "Token expirado" AND a `refresh_token` is present in Secure_Storage, THEN THE Auth_Interceptor SHALL request a new `access_token` from Supabase using that stored `refresh_token`, before retrying the original sync request.
2. WHEN the Supabase refresh call succeeds, THE Auth_Manager SHALL update the Session in memory and in Secure_Storage with the new `access_token` and `refresh_token`, and THE Auth_Interceptor SHALL retry the original failed sync request exactly once with the new `access_token`.
3. WHILE a token refresh is in progress, THE Mobile_App SHALL continue to accept local WatermelonDB write operations and SHALL NOT block any UI interaction.
4. WHILE a token refresh is in progress, THE Auth_Interceptor SHALL queue any subsequent sync request that arrives, and SHALL dispatch each queued request only after the refresh completes, such that at most one refresh call is made concurrently.
5. IF the retried sync request (after a successful refresh) still fails, THEN THE Sync_Engine SHALL leave the affected records in the Pending_Sync_Queue and SHALL treat the failure per Requirement 5, without corrupting or dropping any pending record, and THE Auth_Interceptor SHALL NOT initiate a second token refresh attempt for that same original request regardless of the retried request's response status code.
6. IF the Supabase refresh call fails because the stored `refresh_token` is invalid or expired, THEN THE Auth_Manager SHALL treat the Session as invalid per Requirement 11, and SHALL preserve all Pending_Sync_Queue records in WatermelonDB unmodified.
7. IF a sync request receives an HTTP 401 response with the message "Token expirado" and no `refresh_token` is present in Secure_Storage, THEN THE Auth_Manager SHALL treat the Session as invalid per Requirement 11 without attempting a Supabase refresh call.
8. IF the Supabase refresh call fails due to a network error (timeout, connection refused, or no connectivity) rather than an invalid or expired `refresh_token`, THEN THE Auth_Interceptor SHALL leave the affected records in the Pending_Sync_Queue, SHALL NOT treat the Session as invalid, and SHALL retry the refresh attempt on the next synchronization trigger per Requirement 5.

### Requirement 11: Sessão Inválida e Redirecionamento para Login

**User Story:** Como usuário do GymNight, quero ser redirecionado para a tela de login quando minha sessão não pode mais ser validada, para que eu entenda claramente que preciso me autenticar novamente.

#### Acceptance Criteria

1. IF a sync request receives an HTTP 401 response with the message "Token inválido" or "Token não fornecido", or with any 401 message not explicitly handled by Requirement 10, THEN THE Auth_Manager SHALL clear the Session from Secure_Storage, SHALL clear the in-memory Session used by the Auth_Interceptor (Requirement 9.2), and SHALL navigate the Mobile_App to the Auth_Screen.
2. IF the Supabase token refresh call fails as described in Requirement 10.6, THEN THE Auth_Manager SHALL clear the Session from Secure_Storage, SHALL clear the in-memory Session used by the Auth_Interceptor (Requirement 9.2), and SHALL navigate the Mobile_App to the Auth_Screen.
3. WHEN the Mobile_App navigates to the Auth_Screen due to an invalid session, THE Auth_Screen SHALL display a message informing the user that their session has expired and re-authentication is required. IF displaying that message fails due to a UI rendering error, THEN THE Auth_Screen SHALL retry displaying the message, or SHALL prevent the user from proceeding past the Auth_Screen until the message is successfully displayed, so that the user is never left on the Auth_Screen without understanding why they were logged out.
4. THE Auth_Manager SHALL NOT delete any WatermelonDB domain records when invalidating a session due to an authentication failure, and SHALL preserve the `_status` of every Pending_Sync_Queue record unmodified so those changes can be resynchronized after the user re-authenticates.
5. WHEN the Session is cleared per Criterion 11.1 or 11.2, THE Auth_Interceptor SHALL discard any sync request queued per Requirement 10.4 that has not yet been dispatched, rather than dispatching it after the Session has been cleared.

### Requirement 12: Logout

**User Story:** Como usuário do GymNight, quero poder sair da minha conta de forma explícita, para que outra pessoa usando o mesmo dispositivo não acesse meus dados de treino.

#### Acceptance Criteria

1. IF a logout action is triggered while the Pending_Sync_Queue contains unsynchronized records, THEN THE Mobile_App SHALL display a confirmation prompt warning the user that unsynchronized changes will be lost before the logout proceeds.
2. IF the user declines the confirmation prompt described in Criterion 12.1, THEN THE Mobile_App SHALL abort the logout action, SHALL NOT invalidate the Session, and SHALL leave all local WatermelonDB records and the Pending_Sync_Queue unchanged.
3. WHEN a user triggers the logout action and either the Pending_Sync_Queue is empty or the user has confirmed proceeding per Criterion 12.1, THE Auth_Manager SHALL attempt to invalidate the Session with Supabase, and SHALL clear the Session from Secure_Storage regardless of whether the Supabase invalidation attempt succeeds or fails due to a network error.
4. WHEN the Session has been cleared from Secure_Storage per Criterion 12.3, THE Mobile_App SHALL delete all local WatermelonDB records across the six syncable tables defined in Requirement 1.1 and SHALL clear the locally persisted last_pulled_at value, so that a subsequent login by a different user on the same device does not display stale data and the Sync_Engine performs a full pull on the next synchronization cycle.
5. IF the local WatermelonDB deletion described in Criterion 12.4 fails, THEN THE Mobile_App SHALL retry the deletion once immediately, SHALL display an error message indicating that the device's local data could not be fully cleared if the retry also fails, and SHALL NOT navigate to the Dashboard_Screen for any subsequent login until the deletion succeeds.
6. WHEN the local WatermelonDB deletion described in Criterion 12.4 completes successfully, THE Mobile_App SHALL navigate to the Auth_Screen.

---

### Pilar 3 — Design System

### Requirement 13: Design Tokens Centralizados

**User Story:** Como desenvolvedor do GymNight, quero um conjunto único de Design Tokens para cores, tipografia e espaçamento, para que a identidade visual dark mode com acentos neon seja consistente em todo o app.

#### Acceptance Criteria

1. THE Design_Token_Module SHALL define, at minimum, the following color tokens: background, surface, primary (neon accent), primary text, secondary text, success, and error, and SHALL assign each of these tokens a value that is distinct from every other token in this list.
2. THE Design_Token_Module SHALL define a typography scale with at least the heading, body, and caption text styles, and SHALL define a spacing scale with at least four discrete spacing values arranged in strictly increasing order, each distinct from the others, using increments large enough to provide practical layout flexibility (for reference, a scale such as 8, 16, 24, and 32 pixels), and SHALL NOT use a minimal trivial scale such as 1, 2, 3, and 4 pixels.
3. THE Design_Token_Module SHALL expose all defined tokens as named exports importable from a single module path within the Mobile_App source tree.
4. THE Mobile_App SHALL apply the background color token as the default background of each of Auth_Screen, Dashboard_Screen, Workout_Creator_Screen, and Active_Session_Screen, so that the dark mode identity is consistent across the app.
5. THE Design_Token_Module SHALL define a single fixed dark-mode token set, SHALL NOT expose a light-mode or user-switchable theme variant, and SHALL NOT define, export, or otherwise include any light-mode token of any kind within the Design_Token_Module, regardless of whether such a token would be referenced or toggled elsewhere in the Mobile_App.

### Requirement 14: Proibição de Valores de Estilo Hardcoded

**User Story:** Como desenvolvedor do GymNight, quero impedir que cores e espaçamentos sejam declarados diretamente nas telas, para que futuras mudanças de identidade visual sejam feitas em um único lugar.

#### Acceptance Criteria

1. THE Mobile_App SHALL reference color, typography, spacing, and border-radius values in screen and component style definitions exclusively through Design_Token identifiers imported from the Design_Token_Module, from the moment each screen or component is implemented, without any temporary or provisional period in which literal values are used pending later replacement by a Design_Token.
2. THE Mobile_App SHALL NOT declare a literal color value (hex, rgb, or named CSS color), a literal spacing or border-radius value, or a literal typography value (font size, font weight, or font family) directly inside a screen or component style definition, except within the Design_Token_Module itself, and SHALL NOT justify such a literal value as temporary or provisional pending the future creation of a corresponding Design_Token; where no existing Design_Token covers a value needed by a component, THE Mobile_App SHALL create that Design_Token in the Design_Token_Module per Requirement 14.3 before using it in any screen or component style definition.
3. IF a component requires a color, typography, spacing, or border-radius value not yet covered by an existing Design_Token, THEN THE Mobile_App SHALL require that value to be added to the Design_Token_Module before it is used in a screen or component style definition.

### Requirement 15: Indicadores de Estado Visual Consistentes

**User Story:** Como usuário do GymNight, quero identificar visualmente o status de sincronização e mensagens de sucesso/erro de forma consistente, para que eu entenda rapidamente o que está acontecendo no app.

#### Acceptance Criteria

1. WHEN the Sync_Engine's synchronization state is `synced`, THE Sync_Status_Indicator SHALL render using the success color token.
2. WHEN the Sync_Engine's synchronization state is `pending`, THE Sync_Status_Indicator SHALL render using the error color token.
3. WHEN the Sync_Engine's synchronization state is `syncing` or `offline`, THE Sync_Status_Indicator SHALL render using the primary color token.
4. WHEN the Mobile_App displays a user-facing error message, THE Mobile_App SHALL render that message using the error color token defined in the Design_Token_Module.
5. WHEN the Mobile_App displays a user-facing success confirmation, THE Mobile_App SHALL render that confirmation using the success color token defined in the Design_Token_Module.
6. THE Sync_Status_Indicator SHALL always render using the color token that corresponds exactly to the Sync_Engine's current synchronization state (`synced`, `pending`, `syncing`, or `offline`) as defined in Criteria 15.1 through 15.3, and SHALL NOT render using a color token determined by any condition unrelated to the current synchronization state.

---

### Pilar 4 — Telas e Jornada do Usuário

### Requirement 16: Auth Screen

**User Story:** Como usuário do GymNight, quero uma tela única para login e cadastro, para que eu possa acessar o app rapidamente na primeira vez ou nas seguintes.

#### Acceptance Criteria

1. THE Auth_Screen SHALL provide a mode toggle between "login" and "cadastro" (sign-up) using the same form layout.
2. WHILE a sign-in or sign-up request to Supabase is in progress, THE Auth_Screen SHALL display a `loading` UI_State and SHALL disable the submit control to prevent duplicate submissions.
3. IF the device is offline when the user submits the Auth_Screen form, THEN THE Auth_Screen SHALL display an `offline` UI_State message indicating that authentication requires a network connection, without attempting the request.
4. IF Supabase returns an authentication error, THEN THE Auth_Screen SHALL display an `error` UI_State showing the returned error message and SHALL keep the entered email (not the password) in the form.
5. THE Auth_Screen SHALL validate that the email field is non-empty and contains an "@" character, and that the password field is non-empty, before enabling the submit control.

### Requirement 17: Dashboard Screen

**User Story:** Como usuário do GymNight, quero ver meu treino do dia e o status de sincronização ao abrir o app, para que eu tenha uma visão rápida do que fazer e da confiabilidade dos meus dados.

#### Acceptance Criteria

1. WHEN the Dashboard_Screen mounts, THE Dashboard_Screen SHALL render a Reactive_Query result showing the current user's Workouts and recent WorkoutSessions from WatermelonDB.
2. THE Dashboard_Screen SHALL render the Sync_Status_Indicator reflecting the current state of the Sync_Engine (`synced`, `syncing`, `pending`, or `offline`).
3. WHILE the initial Reactive_Query for the Dashboard_Screen has not yet returned data, THE Dashboard_Screen SHALL display a `loading` UI_State.
4. IF the current user has zero Workouts recorded, THEN THE Dashboard_Screen SHALL display an `empty` UI_State with a call-to-action to create the first Workout.
5. IF the Network_Monitor reports the device as offline, THEN THE Dashboard_Screen SHALL display an `offline` UI_State banner while still rendering all locally available data.
6. THE Dashboard_Screen SHALL display quick statistics (at minimum: total WorkoutSessions completed and total Volume logged) computed from local WatermelonDB data, without requiring a network request.

### Requirement 18: Workout Creator Screen

**User Story:** Como usuário do GymNight, quero montar um treino estruturado escolhendo exercícios do catálogo, para que eu possa seguir uma rotina definida durante a sessão ativa.

#### Acceptance Criteria

1. THE Workout_Creator_Screen SHALL allow the user to create a new Workout with a name and zero or more associated WorkoutExercise entries.
2. WHEN the user adds an exercise to a Workout being created, THE Workout_Creator_Screen SHALL let the user select the exercise from the local Exercise catalog and SHALL require `series_target`, `reps_target`, and `weight_target` values before the exercise entry can be saved.
3. WHEN the user saves a Workout, THE Workout_Creator_Screen SHALL persist the Workout and its WorkoutExercise entries to WatermelonDB in a single local transaction.
4. WHILE the local Exercise catalog Reactive_Query has not yet returned data, THE Workout_Creator_Screen SHALL display a `loading` UI_State for the exercise picker.
5. IF the local Exercise catalog contains zero exercises, THEN THE Workout_Creator_Screen SHALL display an `empty` UI_State informing the user that the catalog has not yet synchronized, and SHALL suggest connecting to the network.
6. IF the user attempts to save a Workout with an empty name, THEN THE Workout_Creator_Screen SHALL display an `error` UI_State on the name field and SHALL NOT persist the Workout.
7. THE Workout_Creator_Screen SHALL function fully (create, edit, and save Workouts) while the device is offline, per Requirement 2 and Requirement 3.

### Requirement 19: Active Session Screen

**User Story:** Como usuário do GymNight, quero registrar minhas séries instantaneamente durante o treino e ver meu progresso em tempo real, para que eu possa focar no treino sem me preocupar com conectividade.

#### Acceptance Criteria

1. WHEN the user starts a training session, THE Active_Session_Screen SHALL create a WorkoutSession record in WatermelonDB with `started_at` set to the current timestamp and `ended_at` set to null.
2. WHERE the session is started without a pre-defined Workout, THE Active_Session_Screen SHALL create the WorkoutSession as a Freestyle_Session (`workout_id` set to null).
3. THE Active_Session_Screen SHALL display a running timer showing elapsed time since the WorkoutSession's `started_at` value, updated at least once per second.
4. WHEN the user logs a completed set, THE Active_Session_Screen SHALL create a LoggedSet record in WatermelonDB immediately, associated with the current WorkoutSession and the selected exercise, with `completed_at` set to the current timestamp.
5. WHEN a LoggedSet is created and the user did not supply an explicit one-rep-max value, THE Active_Session_Screen SHALL compute `estimated_one_rm` using the Epley_Formula from the entered `weight` and `repetitions` values before persisting the record.
6. WHEN a LoggedSet is created or the WorkoutSession's LoggedSets change, THE Active_Session_Screen SHALL recompute and display the session's total Volume and the highest `estimated_one_rm` per exercise using a Reactive_Query, without requiring a network request.
7. WHEN the user ends the training session, THE Active_Session_Screen SHALL set the WorkoutSession's `ended_at` field to the current timestamp in WatermelonDB.
8. WHILE a WorkoutSession has `ended_at` equal to null, THE Mobile_App SHALL treat the session as in-progress and SHALL offer the user the option to resume it from the Dashboard_Screen.
9. THE Active_Session_Screen SHALL remain available and ready to operate (start session, log sets, compute Volume and estimated one-rep-max, end session) while the device is offline, without requiring network connectivity for any of these operations; this Criterion does not guarantee that every individual operation attempt succeeds, which is governed separately by Criterion 19.10 for LoggedSet persistence failures.
10. IF the Active_Session_Screen fails to persist a LoggedSet to WatermelonDB, THEN THE Active_Session_Screen SHALL display an `error` UI_State for that specific set entry and SHALL retain the entered values so the user can retry without re-entering data.

---

### Pilar 5 — Estratégia de Testes

### Requirement 20: Testes de Componente e Renderização

**User Story:** Como desenvolvedor do GymNight, quero testes automatizados de renderização para as telas principais, para que regressões visuais e de comportamento de UI sejam detectadas antes de chegar à produção.

#### Acceptance Criteria

1. THE Mobile_App test suite SHALL include a component render test for each of Auth_Screen, Dashboard_Screen, Workout_Creator_Screen, and Active_Session_Screen.
2. FOR EACH of the four screens listed in Requirement 20.1, THE Mobile_App test suite SHALL include at least one test case per UI_State (`loading`, `offline`, `error`, `empty`) applicable to that screen, as defined in Requirements 16 through 19.
3. THE Mobile_App test suite SHALL verify, for at least one interactive component per screen, that a user interaction (e.g., button press, form submission) triggers the expected callback or state change.
4. THE Mobile_App test suite SHALL execute without requiring a running backend server or a real WatermelonDB SQLite file on disk.

### Requirement 21: Mock do WatermelonDB para Isolamento de Regras de Negócio

**User Story:** Como desenvolvedor do GymNight, quero testar as regras de negócio das telas sem depender de um banco de dados real, para que os testes sejam rápidos, determinísticos e isolados.

#### Acceptance Criteria

1. THE Mobile_App test suite SHALL provide a Mock_Database_Adapter that implements the WatermelonDB collection query interface used by the screens under test (`find`, `query`, `observe`, `create`, `update`, `markAsDeleted`).
2. WHEN a test uses the Mock_Database_Adapter, THE Mobile_App test suite SHALL allow pre-seeding in-memory records for any of the six syncable tables without touching a real SQLite file.
3. THE Mobile_App test suite SHALL include at least one test verifying the Epley_Formula computation described in Requirement 19.5 using the Mock_Database_Adapter, independent of the Sync_Engine or any network call.
4. THE Mobile_App test suite SHALL include at least one test verifying the Volume computation described in Requirement 19.6 using the Mock_Database_Adapter, covering the case of zero LoggedSets (Volume equals zero) and the case of multiple LoggedSets across different exercises.
5. THE Mobile_App test suite SHALL NOT require network connectivity or a running instance of the Sync_Router to execute the business-logic tests described in this Requirement.
