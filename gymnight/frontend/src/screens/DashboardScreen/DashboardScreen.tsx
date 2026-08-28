/**
 * DashboardScreen Component
 *
 * Porta a tela principal do GymNight-Desktop (`dashboard.py`, `_build`):
 * hero com saudação, grade 2×2 de métricas, atividade semanal, lista de
 * treinos e histórico recente. Usa Design_Tokens exclusivamente.
 *
 * Props:
 * - isOnline: whether the device is connected
 * - isLoading: whether data is still loading (first emission pending)
 * - profile: nome/peso/altura do usuário para o hero (null enquanto não carregou)
 * - stats: métricas dos quatro StatCards
 * - workouts: array of workout summaries to display (with rich per-workout stats)
 * - recentSessions: últimas sessões encerradas, mais recente primeiro
 * - weeklyStreak: 7 booleans, index 0 = Sunday of the current week; true = trained that day
 * - syncStatus: current sync engine state
 * - onCreateWorkout: callback invoked when the user taps the CTA to create a workout
 * - onStartSession: callback invoked with a workout's id when the user taps it to start a session
 * - onLogout: callback invoked when the user logs out
 *
 * O `weeklyStreak` continua chegando com domingo no índice 0 (é o que
 * `Date.getDay()` devolve); a reordenação para segunda→domingo, como o desktop
 * exibe, acontece só aqui na renderização via `reorderWeekMondayFirst`.
 */

import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, typography, spacing } from '../../designSystem/tokens';
import { Banner } from '../../designSystem/components/Banner';
import { Button } from '../../designSystem/components/Button';
import { Card } from '../../designSystem/components/Card';
import { DayDot } from '../../designSystem/components/DayDot';
import { EmptyState } from '../../designSystem/components/EmptyState';
import { HeroBanner } from '../../designSystem/components/HeroBanner';
import { SectionTitle } from '../../designSystem/components/SectionTitle';
import { StatCard } from '../../designSystem/components/StatCard';
import {
  formatRelativeDay,
  formatVolume,
  reorderWeekMondayFirst,
} from '../../hooks/historyDomainUtils';
import { type SyncState } from '../../sync/SyncStatusIndicator';

export interface DashboardWorkout {
  id: string;
  name: string;
  exerciseCount: number;
  avgSessionDurationMs: number | null;
  lastTrainedDaysAgo: number | null;
}

/** Sessão encerrada exibida no card "Treinos recentes". */
export interface DashboardRecentSession {
  id: string;
  /** null quando a sessão não veio de um treino salvo ("Treino livre"). */
  workoutName: string | null;
  startedAt: number;
  durationMs: number | null;
  totalVolume: number;
}

export interface DashboardProfile {
  name: string;
  weight: number | null;
  height: number | null;
}

export interface DashboardStatsProps {
  trainingDaysThisWeek: number;
  totalVolume: number;
  totalSets: number;
  weekStreak: number;
}

export interface DashboardScreenProps {
  isOnline: boolean;
  isLoading: boolean;
  workouts: DashboardWorkout[];
  weeklyStreak: boolean[];
  syncStatus: SyncState;
  profile?: DashboardProfile | null;
  stats?: DashboardStatsProps;
  recentSessions?: DashboardRecentSession[];
  onCreateWorkout: () => void;
  onStartSession: (workoutId: string) => void;
  onLogout: () => void;
}

/** Labels da semana começando na segunda, como o desktop (dashboard.py:383). */
const WEEK_LABELS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'] as const;

const EMPTY_STATS: DashboardStatsProps = {
  trainingDaysThisWeek: 0,
  totalVolume: 0,
  totalSets: 0,
  weekStreak: 0,
};

function formatAvgDuration(ms: number | null): string {
  if (ms === null) return '—';
  return `${Math.round(ms / 60000)} min`;
}

function formatLastTrained(daysAgo: number | null): string {
  if (daysAgo === null) return 'nunca';
  if (daysAgo === 0) return 'hoje';
  if (daysAgo === 1) return 'ontem';
  return `há ${daysAgo} dias`;
}

/**
 * Subtítulo do hero: `78kg · 180cm`. Campos nulos são omitidos junto com o
 * separador — nunca renderiza "nullkg" (weight/height são isOptional no schema).
 */
function formatProfileSubtitle(profile: DashboardProfile | null | undefined): string {
  if (!profile) return '';
  const parts: string[] = [];
  if (profile.weight !== null && profile.weight !== undefined) {
    parts.push(`${Math.round(profile.weight)}kg`);
  }
  if (profile.height !== null && profile.height !== undefined) {
    parts.push(`${Math.round(profile.height)}cm`);
  }
  return parts.join(' · ');
}

/** Valor à direita de uma sessão recente: volume se houve carga, senão duração. */
function formatSessionValue(session: DashboardRecentSession): string {
  if (session.totalVolume > 0) return `${formatVolume(session.totalVolume)} kg`;
  if (session.durationMs !== null) return `${Math.round(session.durationMs / 60000)} min`;
  return '—';
}

/**
 * Linha de lista no padrão `_WorkoutItem` do desktop (dashboard.py:202-226):
 * nome + subtítulo à esquerda, valor à direita, separador entre itens.
 */
function ListRow({
  title,
  subtitle,
  value,
  isLast,
  onPress,
  testID,
  accessibilityLabel,
}: {
  title: string;
  subtitle: string;
  value: string;
  isLast: boolean;
  onPress?: () => void;
  testID?: string;
  accessibilityLabel?: string;
}) {
  const body = (
    <React.Fragment>
      <View style={styles.rowMain}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowSubtitle}>{subtitle}</Text>
      </View>
      <Text style={styles.rowValue}>{value}</Text>
    </React.Fragment>
  );

  const rowStyle = [styles.row, !isLast && styles.rowDivider];

  if (!onPress) {
    return (
      <View style={rowStyle} testID={testID}>
        {body}
      </View>
    );
  }

  return (
    <TouchableOpacity
      style={rowStyle}
      testID={testID}
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
    >
      {body}
    </TouchableOpacity>
  );
}

export function DashboardScreen({
  isOnline,
  isLoading,
  workouts,
  weeklyStreak,
  syncStatus,
  profile,
  stats = EMPTY_STATS,
  recentSessions = [],
  onCreateWorkout,
  onStartSession,
  onLogout,
}: DashboardScreenProps) {
  const hasData = workouts.length > 0;

  // Loading state: only show spinner
  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']} testID="dashboard-screen">
        <View style={styles.loadingContainer} testID="loading-state">
          <ActivityIndicator testID="loading-indicator" size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const greetingName = (profile?.name ?? '').trim().toUpperCase();
  const subtitle = formatProfileSubtitle(profile);
  const orderedStreak = reorderWeekMondayFirst(weeklyStreak);

  return (
    <SafeAreaView style={styles.container} edges={['top']} testID="dashboard-screen">
      <ScrollView contentContainerStyle={styles.scrollContent} testID="dashboard-scroll">
        {/* Offline Banner */}
        {!isOnline && (
          <Banner
            message="Você está offline. Dados locais disponíveis."
            variant="info"
            testID="offline-banner"
          />
        )}

        {/* Hero — saudação + perfil (dashboard.py:261-265) */}
        <HeroBanner testID="dashboard-hero">
          <Text style={styles.greeting}>
            BOM TREINO
            {greetingName ? <Text style={styles.greetingName}>, {greetingName}</Text> : null}
          </Text>
          {subtitle ? (
            <Text style={styles.heroSubtitle} testID="hero-subtitle">
              {subtitle}
            </Text>
          ) : null}
        </HeroBanner>

        {/* Grade 2×2 de métricas — o desktop usa 1×4 (dashboard.py:305-318) */}
        <View style={styles.statsGrid} testID="dashboard-stats">
          <View style={styles.statsCell}>
            <StatCard
              icon="dumbbell"
              title="Treinos esta semana"
              value={String(stats.trainingDaysThisWeek)}
              unit="dias"
              testID="stat-training-days"
            />
          </View>
          <View style={styles.statsCell}>
            <StatCard
              icon="weight-hanging"
              title="Volume total"
              value={formatVolume(stats.totalVolume)}
              unit="kg"
              testID="stat-total-volume"
            />
          </View>
          <View style={styles.statsCell}>
            <StatCard
              icon="layer-group"
              title="Séries"
              value={String(stats.totalSets)}
              unit="séries"
              testID="stat-total-sets"
            />
          </View>
          <View style={styles.statsCell}>
            <StatCard
              icon="chart-line"
              title="Streak"
              value={String(stats.weekStreak)}
              unit="sem"
              testID="stat-week-streak"
            />
          </View>
        </View>

        {/* Atividade semanal — 7 DayDot, segunda→domingo */}
        <Card testID="weekly-streak-card">
          <SectionTitle>Atividade semanal</SectionTitle>
          <View style={styles.streakContainer} testID="weekly-streak">
            {orderedStreak.map((trained, index) => (
              <DayDot
                key={WEEK_LABELS[index]}
                day={WEEK_LABELS[index]}
                active={trained}
                testID={`streak-day-${index}`}
              />
            ))}
          </View>
        </Card>

        {/* Seus treinos — o botão "+ Novo" é a rota para o WorkoutCreator que
            antes só existia dentro do empty state */}
        <Card testID="workouts-card">
          <SectionTitle
            right={
              <Button
                label="Novo"
                icon="plus"
                variant="outlineAccent"
                fullWidth={false}
                onPress={onCreateWorkout}
                testID="create-workout-button"
                accessibilityLabel="Criar novo treino"
              />
            }
          >
            Seus treinos
          </SectionTitle>

          {hasData ? (
            <View testID="workout-list">
              {workouts.map((item, index) => (
                <ListRow
                  key={item.id}
                  testID={`workout-item-${item.id}`}
                  title={item.name}
                  subtitle={`${item.exerciseCount} exercícios · média ${formatAvgDuration(item.avgSessionDurationMs)}`}
                  value={formatLastTrained(item.lastTrainedDaysAgo)}
                  isLast={index === workouts.length - 1}
                  onPress={() => onStartSession(item.id)}
                  accessibilityLabel={`Iniciar sessão de ${item.name}`}
                />
              ))}
            </View>
          ) : (
            <View testID="empty-state">
              {/* O EmptyState deriva o testID do botão como `${testID}-action`,
                  então o CTA vira "create-workout-action". */}
              <EmptyState
                message="Nenhum treino encontrado."
                actionLabel="Criar primeiro treino"
                onAction={onCreateWorkout}
                testID="create-workout"
              />
            </View>
          )}
        </Card>

        {/* Treinos recentes (dashboard.py:512-563) */}
        <Card testID="recent-sessions-card">
          <SectionTitle>Treinos recentes</SectionTitle>
          {recentSessions.length > 0 ? (
            <View testID="recent-sessions-list">
              {recentSessions.map((session, index) => (
                <ListRow
                  key={session.id}
                  testID={`recent-session-${session.id}`}
                  title={session.workoutName ?? 'Treino livre'}
                  subtitle={formatRelativeDay(session.startedAt)}
                  value={formatSessionValue(session)}
                  isLast={index === recentSessions.length - 1}
                />
              ))}
            </View>
          ) : (
            <Text style={styles.emptyRecent} testID="recent-sessions-empty">
              Nenhum treino registrado ainda.
            </Text>
          )}
        </Card>

        {/* Logout */}
        <Button
          label="Sair"
          variant="danger"
          onPress={onLogout}
          testID="logout-button"
          accessibilityLabel="Sair"
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  greeting: {
    ...typography.h1,
    color: colors.primaryText,
  },
  greetingName: {
    color: colors.primary,
  },
  heroSubtitle: {
    ...typography.sub,
    color: colors.tertiaryText,
    letterSpacing: 1,
    marginTop: spacing.xs,
  },
  // `flexBasis: '48%'` com `flexWrap` é o que produz a grade 2×2 sem depender
  // de medir a largura da tela.
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  statsCell: {
    flexGrow: 1,
    flexBasis: '48%',
  },
  streakContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowMain: {
    flex: 1,
    gap: spacing.xxs,
  },
  rowTitle: {
    ...typography.bodyBold,
    color: colors.primaryText,
  },
  rowSubtitle: {
    ...typography.sub,
    color: colors.secondaryText,
  },
  rowValue: {
    ...typography.sub,
    color: colors.secondaryText,
  },
  emptyRecent: {
    ...typography.body,
    color: colors.secondaryText,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
});
