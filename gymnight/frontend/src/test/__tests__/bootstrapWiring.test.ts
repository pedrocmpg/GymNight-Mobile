/**
 * Task 16.3: one-shot wiring tests for the Bootstrap_Sequence in App.tsx.
 *
 * App.tsx transitively imports @react-navigation, which requires deep native
 * mocks (Animated, TurboModuleRegistry, safe-area context) to render via
 * @testing-library/react-native in this project's test environment — the
 * same limitation documented for AppNavigator.tsx itself. Per the project's
 * existing convention for verifying wiring/structural invariants (see
 * src/config/__tests__/envReadSites.test.ts, src/navigation/__tests__/
 * AppNavigator.routes.test.ts), this is verified via static inspection of
 * App.tsx's source instead of a full component render.
 *
 * Validates: Requirements 3.5, 4.5, 4.6, 5.4, 6.1, 6.2, 7.4, 9.1, 10.3
 */
import * as fs from 'fs';
import * as path from 'path';

const APP_TSX_PATH = path.resolve(__dirname, '../../../App.tsx');

describe('Bootstrap_Sequence wiring (App.tsx)', () => {
  const content = fs.readFileSync(APP_TSX_PATH, 'utf-8');

  it('no longer renders the placeholder ("GymNight Mobile" static text)', () => {
    expect(content).not.toMatch(/GymNight Mobile/);
  });

  it('calls validateEnvConfig and renders StartupErrorScreen on invalid config (Requirement 1.6)', () => {
    expect(content).toMatch(/validateEnvConfig\(\)/);
    expect(content).toMatch(/StartupErrorScreen/);
  });

  it('constructs AuthManager with the JWT-based Token_Validator and Supabase-backed Session_Refresher (Requirements 3.5, 4.5, 4.6)', () => {
    expect(content).toMatch(/new AuthManager\(\s*supabaseAuthClient,\s*undefined,\s*jwtTokenValidator,\s*sessionRefresher\s*\)/);
    expect(content).toMatch(/createSupabaseAuthClientAdapter\(supabaseClient\)/);
    expect(content).toMatch(/createSupabaseSessionRefresher\(supabaseClient\)/);
  });

  it('constructs AuthInterceptor with the SessionStore-backed SessionProvider (Requirement 10.3)', () => {
    expect(content).toMatch(/new AuthInterceptor\(sessionStore\)/);
  });

  it('constructs LogoutManager with the three concrete logout port adapters (Requirement 7.4)', () => {
    expect(content).toMatch(/createSupabaseLogoutPort\(supabaseClient\)/);
    expect(content).toMatch(/createLogoutStoragePort\(sessionStore\)/);
    expect(content).toMatch(/createLogoutWipePort\(database\)/);
    expect(content).toMatch(/new LogoutManager\(\{/);
  });

  it('constructs SyncEngine with a real Sync_Cycle_Runner (Requirement 9.1)', () => {
    expect(content).toMatch(/createSyncCycleRunner\(\{/);
    expect(content).toMatch(/new SyncEngine\(syncCycleRunner\)/);
  });

  it('renders AppNavigator with authManager, syncEngine, logoutManager, sessionStore (Requirement 5.4)', () => {
    expect(content).toMatch(/<AppNavigator[\s\S]*?authManager={authManager}[\s\S]*?\/>/);
    expect(content).toMatch(/syncEngine={syncEngine}/);
    expect(content).toMatch(/logoutManager={logoutManager}/);
    expect(content).toMatch(/sessionStore={sessionStore}/);
  });
});
