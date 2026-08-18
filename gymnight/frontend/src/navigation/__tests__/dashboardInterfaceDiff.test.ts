/**
 * Structural test (task 13.2): Dashboard_Screen's interface diff is limited
 * to the two new callbacks; AuthScreen, WorkoutCreatorScreen,
 * ActiveSessionScreen interfaces are untouched.
 *
 * Validates: Requirements 14.3, 14.4, 14.5
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
  it('DashboardScreenProps contains exactly the original members plus onStartSession and onLogout', () => {
    const content = fs.readFileSync(
      path.join(SCREENS_DIR, 'DashboardScreen', 'DashboardScreen.tsx'),
      'utf-8'
    );
    const members = extractInterfaceMembers(content, 'DashboardScreenProps');

    expect(new Set(members)).toEqual(
      new Set(['isOnline', 'isLoading', 'workouts', 'syncStatus', 'onCreateWorkout', 'onStartSession', 'onLogout'])
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
    expect(new Set(extractInterfaceMembers(activeSessionContent, 'ActiveSessionProps'))).toEqual(
      new Set(['session', 'loggedSets', 'totalVolume', 'exerciseOptions', 'onLogSet', 'onEndSession'])
    );
  });
});
