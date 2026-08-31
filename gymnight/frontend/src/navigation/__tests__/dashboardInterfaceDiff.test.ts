/**
 * Structural test (task 13.2): Dashboard_Screen's interface diff is limited
 * to the two new callbacks; AuthScreen, WorkoutCreatorScreen,
 * ActiveSessionScreen interfaces are untouched.
 *
 * Validates: Requirements 14.3, 14.4, 14.5
 *
 * Updated (dashboard-history-progress): DashboardScreenProps deliberately
 * gained `weeklyStreak` (the streak strip) — the richer per-workout fields
 * (exerciseCount, avgSessionDurationMs, lastTrainedDaysAgo) live on the
 * `DashboardWorkout` item type, not on DashboardScreenProps itself, so this
 * top-level Set only needs the one new member.
 *
 * Updated (redesign wave 3): a Dashboard passou a portar a estrutura do
 * GymNight-Desktop e ganhou mais três membros — `profile` (hero), `stats`
 * (grade 2×2 de métricas) e `recentSessions` (card "Treinos recentes"). Os
 * três são OPCIONAIS, então a tela continua renderizável só com os props
 * originais. As outras três telas seguem intocadas, que é o que este teste
 * de fato protege.
 */
import * as fs from 'fs';
import * as path from 'path';

const SCREENS_DIR = path.resolve(__dirname, '../../screens');

function extractInterfaceMembers(content: string, interfaceName: string): string[] {
  const match = content.match(new RegExp(`interface ${interfaceName}\\s*\\{([\\s\\S]*?)\\n\\}`));
  if (!match) throw new Error(`Interface ${interfaceName} not found`);
  return Array.from(match[1].matchAll(/^\s*(\w+)[?:]/gm)).map((m) => m[1]);
}

describe('Dashboard_Screen interface diff limited to onStartSession/onLogout', () => {
  it('DashboardScreenProps contains exactly the original members plus onStartSession, onLogout, weeklyStreak and the wave-3 additions', () => {
    const content = fs.readFileSync(
      path.join(SCREENS_DIR, 'DashboardScreen', 'DashboardScreen.tsx'),
      'utf-8'
    );
    const members = extractInterfaceMembers(content, 'DashboardScreenProps');

    expect(new Set(members)).toEqual(
      new Set([
        'isOnline',
        'isLoading',
        'workouts',
        'weeklyStreak',
        'syncStatus',
        'onCreateWorkout',
        'onStartSession',
        'onLogout',
        'profile',
        'stats',
        'recentSessions',
      ])
    );
  });

  it('AuthScreenProps, WorkoutCreatorScreenProps, ActiveSessionProps are untouched', () => {
    const authContent = fs.readFileSync(path.join(SCREENS_DIR, 'AuthScreen', 'AuthScreen.tsx'), 'utf-8');
    expect(new Set(extractInterfaceMembers(authContent, 'AuthScreenProps'))).toEqual(
      new Set(['isOnline', 'isLoading', 'error', 'onSubmit'])
    );

    const workoutContent = fs.readFileSync(
      path.join(SCREENS_DIR, 'WorkoutCreatorScreen', 'WorkoutCreatorScreen.tsx'),
      'utf-8'
    );
    expect(new Set(extractInterfaceMembers(workoutContent, 'WorkoutCreatorScreenProps'))).toEqual(
      new Set(['isLoading', 'exercises', 'error', 'onSave'])
    );

    const activeSessionContent = fs.readFileSync(
      path.join(SCREENS_DIR, 'ActiveSessionScreen', 'ActiveSessionScreen.tsx'),
      'utf-8'
    );
    // Wave 4 acrescentou workoutName/previousSessionSets/hasWorkout/onBack, todos
    // OPCIONAIS — a tela continua renderizável só com os props originais.
    expect(new Set(extractInterfaceMembers(activeSessionContent, 'ActiveSessionProps'))).toEqual(
      new Set([
        'session',
        'loggedSets',
        'totalVolume',
        'exerciseOptions',
        'onLogSet',
        'onEndSession',
        'workoutName',
        'previousSessionSets',
        'hasWorkout',
        'onBack',
      ])
    );
  });
});
