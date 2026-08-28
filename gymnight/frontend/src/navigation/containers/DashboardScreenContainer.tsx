import React, { useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { DashboardScreen } from '../../screens/DashboardScreen/DashboardScreen';
import { Banner } from '../../designSystem/components/Banner';
import { useObserveDashboard } from '../../hooks/useObserveDashboard';
import type { SyncEngine } from '../../sync/SyncEngine';
import type { LogoutManager } from '../../auth/LogoutManager';
import type { SyncState } from '../../sync/SyncStatusIndicator';
import database from '../../db/database';
import { createDashboardDatabaseProvider } from '../watermelonProviders';
import { createLogoutCoordinator } from '../logoutRouting';
import { startSessionWithPersistence } from '../../screens/ActiveSessionScreen/startSessionWithPersistence';
import { resolveStartSessionOutcome } from '../startSessionRouting';
import { daysSince } from '../../hooks/historyDomainUtils';

export interface DashboardScreenContainerProps {
  syncEngine: SyncEngine;
  logoutManager: LogoutManager;
  userId: string;
  onCreateWorkout: () => void;
  onSessionStarted: (sessionId: string) => void;
  onLoggedOut: () => void;
}

/** Derives a SyncState from SyncEngine's own state (Requirement 8.1). */
function useSyncStatus(syncEngine: SyncEngine, isOnline: boolean): SyncState {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, [syncEngine]);

  void tick;

  if (!isOnline) return 'offline';
  if (syncEngine.isCycleInProgress) return 'syncing';
  return 'synced';
}

export function DashboardScreenContainer(props: DashboardScreenContainerProps) {
  const [isOnline, setIsOnline] = useState(true);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const [startSessionError, setStartSessionError] = useState<string | null>(null);
  const coordinatorRef = React.useRef<ReturnType<typeof createLogoutCoordinator> | null>(null);
  if (coordinatorRef.current === null) {
    coordinatorRef.current = createLogoutCoordinator(props.logoutManager);
  }

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOnline(state.isConnected === true);
    });
    return unsubscribe;
  }, []);

  const provider = React.useMemo(() => createDashboardDatabaseProvider(database), []);
  const { workouts, weeklyStreak, isLoading } = useObserveDashboard(props.userId, provider);
  const syncStatus = useSyncStatus(props.syncEngine, isOnline);

  const handleLogout = async () => {
    if (coordinatorRef.current!.isPending()) return; // Requirement 7.8: ignore concurrent triggers
    setLogoutError(null);
    const result = await coordinatorRef.current!.requestLogout({
      session: null,
      domainRecords: [],
      pendingQueue: [],
    });
    if (result.navigateToAuth) {
      props.onLoggedOut();
    } else if (result.errorMessage) {
      setLogoutError(result.errorMessage);
    }
  };

  const handleStartSession = async (workoutId: string) => {
    setStartSessionError(null);
    const result = await startSessionWithPersistence(props.userId, workoutId);
    const outcome = resolveStartSessionOutcome(result);
    if (outcome.navigateToActiveSession) {
      props.onSessionStarted(outcome.sessionId);
    } else {
      setStartSessionError(outcome.errorMessage);
    }
  };

  return (
    <>
      {/* Transient logout error indication (Requirement 7.7), independent of onLogout */}
      {logoutError !== null && (
        <Banner message={logoutError} variant="error" testID="logout-error-banner" />
      )}
      {startSessionError !== null && (
        <Banner message={startSessionError} variant="error" testID="start-session-error-banner" />
      )}
      <DashboardScreen
        isOnline={isOnline}
        isLoading={isLoading}
        workouts={workouts.map((w) => ({
          id: w.id,
          name: w.name,
          exerciseCount: w.exerciseCount,
          avgSessionDurationMs: w.avgSessionDurationMs,
          lastTrainedDaysAgo: daysSince(w.lastTrainedAt),
        }))}
        weeklyStreak={weeklyStreak}
        syncStatus={syncStatus}
        onCreateWorkout={props.onCreateWorkout}
        onStartSession={handleStartSession}
        onLogout={handleLogout}
      />
    </>
  );
}
