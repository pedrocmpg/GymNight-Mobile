/**
 * DashboardScreen Component
 *
 * Tela principal: cabeçalho tipográfico (data, saudação, avatar da conta),
 * atividade da semana, treinos salvos, métricas e histórico recente. Usa
 * Design_Tokens exclusivamente (REDESIGN-04).
 *
 * Props:
 * - isOnline: whether the device is connected
 * - isLoading: whether data is still loading (first emission pending)
 * - profile: nome/peso/altura do usuário para o cabeçalho (null enquanto não carregou)
 * - stats: métricas dos quatro StatCards
 * - workouts: array of workout summaries to display (with rich per-workout stats)
 * - recentSessions: últimas sessões encerradas, mais recente primeiro
 * - weeklyStreak: 7 booleans, index 0 = Sunday of the current week; true = trained that day
 * - syncStatus: current sync engine state
 * - onCreateWorkout: callback invoked when the user taps the CTA to create a workout
 * - onStartSession: callback invoked with a workout's id when the user taps it to start a session
 * - onStartCardioSession: callback for the "Cardio" button beside "Novo" (cardio avulso, Wave 9)
 * - onLogout: callback invoked when the user logs out (dentro do sheet da conta)
 *
 * O `weeklyStreak` continua chegando com domingo no índice 0 (é o que
 * `Date.getDay()` devolve); a reordenação para segunda→domingo acontece só
 * aqui na renderização via `reorderWeekMondayFirst`.
 */

import React, { useState } from 'react';
import { View, Text, RefreshControl, StyleSheet } from 'react-native';
import { colors, typography, spacing, radii, layout } from '../../designSystem/tokens';
import { Banner } from '../../designSystem/components/Banner';
import { Button } from '../../designSystem/components/Button';
import { Card } from '../../designSystem/components/Card';
import { DayDot } from '../../designSystem/components/DayDot';
import { EmptyState } from '../../designSystem/components/EmptyState';
import { IconButton } from '../../designSystem/components/IconButton';
import { ListRow } from '../../designSystem/components/ListRow';
import { LoadingState } from '../../designSystem/components/LoadingState';
import { Screen } from '../../designSystem/components/Screen';
import { SectionTitle } from '../../designSystem/components/SectionTitle';
import { Sheet } from '../../designSystem/components/Sheet';
import { StatCard } from '../../designSystem/components/StatCard';
import { Touchable } from '../../designSystem/components/Touchable';
import {
  formatLongDate,
  formatRelativeDay,
  formatVolume,
  reorderWeekMondayFirst,
} from '../../hooks/historyDomainUtils';
import { getSyncStatusColor, type SyncState } from '../../sync/SyncStatusIndicator';

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
  /** Calorias queimadas (musculação) — restaurado na Wave 6, era `totalSets`. */
  totalCalories: number;
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
  /** Pull-to-refresh: dispara um ciclo de sync manual (Wave 4.5). */
  onRefresh?: () => void;
  onCreateWorkout: () => void;
  onStartSession: (workoutId: string) => void;
  /** Ícone de lápis na linha do treino (Wave 8). Sem isto, a linha não mostra o lápis. */
  onEditWorkout?: (workoutId: string) => void;
  /** Botão "Cardio" ao lado de "Novo" (Wave 9). Sem isto, o botão não aparece. */
  onStartCardioSession?: () => void;
  onLogout: () => void;
}

/** Labels da semana começando na segunda, como o desktop (dashboard.py:383). */
const WEEK_LABELS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'] as const;

const EMPTY_STATS: DashboardStatsProps = {
  trainingDaysThisWeek: 0,
  totalVolume: 0,
  totalCalories: 0,
  weekStreak: 0,
};

const SYNC_LABEL: Record<SyncState, string> = {
  synced: 'Tudo sincronizado',
  pending: 'Alterações aguardando envio',
  syncing: 'Sincronizando…',
  offline: 'Offline — dados salvos no aparelho',
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
 * Subtítulo do cabeçalho: `78kg · 180cm`. Campos nulos são omitidos junto com
 * o separador — nunca renderiza "nullkg" (weight/height são isOptional no schema).
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

/** Índice de hoje na semana segunda→domingo. */
function todayIndexMondayFirst(): number {
  return (new Date().getDay() + 6) % 7;
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
  onRefresh,
  onCreateWorkout,
  onStartSession,
  onEditWorkout,
  onStartCardioSession,
  onLogout,
}: DashboardScreenProps) {
  const [isAccountOpen, setAccountOpen] = useState(false);

  if (isLoading) {
    return (
      <Screen edges={['top']} testID="dashboard-screen" scroll={false}>
        <LoadingState testID="loading-state" indicatorTestID="loading-indicator" />
      </Screen>
    );
  }

  const hasData = workouts.length > 0;
  const fullName = (profile?.name ?? '').trim();
  const firstName = fullName.split(/\s+/)[0] ?? '';
  const initial = (firstName[0] ?? '·').toUpperCase();
  const subtitle = formatProfileSubtitle(profile);
  const orderedStreak = reorderWeekMondayFirst(weeklyStreak);
  const trainedDays = orderedStreak.filter(Boolean).length;
  const todayIndex = todayIndexMondayFirst();
  const syncColor = getSyncStatusColor(syncStatus);

  const handleLogout = () => {
    // Fecha antes: o banner de erro do container precisa ficar visível.
    setAccountOpen(false);
    onLogout();
  };

  return (
    <Screen
      edges={['top']}
      testID="dashboard-screen"
      scrollTestID="dashboard-scroll"
      refreshControl={
        onRefresh ? (
          <RefreshControl
            testID="dashboard-refresh-control"
            refreshing={syncStatus === 'syncing'}
            onRefresh={onRefresh}
            tintColor={colors.secondaryText}
            colors={[colors.onPrimary]}
            progressBackgroundColor={colors.primary}
          />
        ) : undefined
      }
    >
      {!isOnline && (
        <Banner
          message="Você está offline. Dados locais disponíveis."
          variant="info"
          testID="offline-banner"
        />
      )}

      {/* Cabeçalho tipográfico: data, saudação e conta */}
      <View style={styles.header} testID="dashboard-hero">
        <View style={styles.headerText}>
          <Text style={styles.date}>{formatLongDate(Date.now())}</Text>
          <Text style={styles.greeting} accessibilityRole="header">
            Bom treino
            {firstName ? <Text style={styles.greetingName}>, {firstName}</Text> : null}
          </Text>
          {subtitle ? (
            <Text style={styles.headerSubtitle} testID="hero-subtitle">
              {subtitle}
            </Text>
          ) : null}
        </View>
        <Touchable
          testID="profile-button"
          onPress={() => setAccountOpen(true)}
          haptic="selection"
          style={styles.avatar}
          accessibilityRole="button"
          accessibilityLabel="Conta"
        >
          <Text style={styles.avatarInitial}>{initial}</Text>
          <View
            testID="sync-status-indicator"
            accessibilityLabel={`Status de sincronização: ${syncStatus}`}
            style={[styles.syncBadge, { backgroundColor: syncColor }]}
          />
        </Touchable>
      </View>

      {/* Esta semana — segunda→domingo, hoje marcado */}
      <View style={styles.section}>
        <SectionTitle meta={`${trainedDays} de 7 dias`}>Esta semana</SectionTitle>
        <View style={styles.week} testID="weekly-streak">
          {orderedStreak.map((trained, index) => (
            <DayDot
              key={WEEK_LABELS[index]}
              day={WEEK_LABELS[index]}
              active={trained}
              isToday={index === todayIndex}
              testID={`streak-day-${index}`}
            />
          ))}
        </View>
      </View>

      {/* Seus treinos */}
      <View style={styles.section}>
        <SectionTitle
          right={
            <View style={styles.sectionActions}>
              {onStartCardioSession && (
                <Button
                  label="Cardio"
                  icon="heartbeat"
                  variant="secondary"
                  size="sm"
                  fullWidth={false}
                  onPress={onStartCardioSession}
                  testID="start-cardio-session-button"
                  accessibilityLabel="Iniciar cardio avulso"
                />
              )}
              <Button
                label="Novo"
                icon="plus"
                variant="secondary"
                size="sm"
                fullWidth={false}
                onPress={onCreateWorkout}
                testID="create-workout-button"
                accessibilityLabel="Criar novo treino"
              />
            </View>
          }
        >
          Seus treinos
        </SectionTitle>

        {hasData ? (
          <Card padding="none" testID="workouts-card">
            <View testID="workout-list">
              {workouts.map((item, index) => (
                <ListRow
                  key={item.id}
                  testID={`workout-item-${item.id}`}
                  title={item.name}
                  subtitle={`${item.exerciseCount} exercícios · média ${formatAvgDuration(item.avgSessionDurationMs)}`}
                  value={formatLastTrained(item.lastTrainedDaysAgo)}
                  divider={index < workouts.length - 1}
                  onPress={() => onStartSession(item.id)}
                  accessibilityLabel={`Iniciar sessão de ${item.name}`}
                  trailing={
                    onEditWorkout ? (
                      <IconButton
                        icon="pencil-alt"
                        size={14}
                        onPress={() => onEditWorkout(item.id)}
                        testID={`workout-item-${item.id}-edit`}
                        accessibilityLabel={`Editar ${item.name}`}
                      />
                    ) : undefined
                  }
                />
              ))}
            </View>
          </Card>
        ) : (
          <Card testID="workouts-card">
            <View testID="empty-state">
              {/* O EmptyState deriva o testID do botão como `${testID}-action`,
                  então o CTA vira "create-workout-action". */}
              <EmptyState
                icon="dumbbell"
                title="Monte seu primeiro treino"
                message="Escolha os exercícios uma vez e registre séries em segundos."
                actionLabel="Criar primeiro treino"
                onAction={onCreateWorkout}
                testID="create-workout"
              />
            </View>
          </Card>
        )}
      </View>

      {/* Resumo — grade 2×2 de métricas */}
      <View style={styles.section}>
        <SectionTitle>Resumo</SectionTitle>
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
              icon="fire"
              title="Calorias"
              value={String(Math.round(stats.totalCalories))}
              unit="kcal"
              testID="stat-total-calories"
            />
          </View>
          <View style={styles.statsCell}>
            <StatCard
              icon="chart-line"
              title="Sequência"
              value={String(stats.weekStreak)}
              unit="sem"
              testID="stat-week-streak"
            />
          </View>
        </View>
      </View>

      {/* Treinos recentes */}
      <View style={styles.section}>
        <SectionTitle>Treinos recentes</SectionTitle>
        {recentSessions.length > 0 ? (
          <Card padding="none" testID="recent-sessions-card">
            <View testID="recent-sessions-list">
              {recentSessions.map((session, index) => (
                <ListRow
                  key={session.id}
                  testID={`recent-session-${session.id}`}
                  title={session.workoutName ?? 'Treino livre'}
                  subtitle={formatRelativeDay(session.startedAt)}
                  value={formatSessionValue(session)}
                  divider={index < recentSessions.length - 1}
                />
              ))}
            </View>
          </Card>
        ) : (
          <Text style={styles.emptyRecent} testID="recent-sessions-empty">
            Nenhum treino registrado ainda.
          </Text>
        )}
      </View>

      {/* Conta — perfil, status de sync e sair */}
      <Sheet
        visible={isAccountOpen}
        onClose={() => setAccountOpen(false)}
        testID="account-sheet"
        panelTestID="account-sheet-panel"
      >
        <View style={styles.accountHeader}>
          <View style={[styles.avatar, styles.avatarLarge]}>
            <Text style={styles.avatarInitialLarge}>{initial}</Text>
          </View>
          <View style={styles.headerText}>
            <Text style={styles.accountName}>{fullName || 'Sua conta'}</Text>
            {subtitle ? <Text style={styles.headerSubtitle}>{subtitle}</Text> : null}
          </View>
        </View>
        <View style={styles.syncRow}>
          <View style={[styles.syncDot, { backgroundColor: syncColor }]} />
          <Text style={styles.syncText}>{SYNC_LABEL[syncStatus]}</Text>
        </View>
        <Button
          label="Sair"
          icon="sign-out-alt"
          variant="danger"
          onPress={handleLogout}
          testID="logout-button"
          accessibilityLabel="Sair"
        />
      </Sheet>
    </Screen>
  );
}

const AVATAR_SIZE = 44;
const AVATAR_SIZE_LARGE = 56;
const SYNC_BADGE_SIZE = 10;

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  headerText: {
    flex: 1,
    gap: spacing.xxs,
  },
  date: {
    ...typography.caption,
    color: colors.secondaryText,
  },
  greeting: {
    ...typography.display,
    color: colors.primaryText,
  },
  greetingName: {
    color: colors.secondaryText,
  },
  headerSubtitle: {
    ...typography.footnote,
    color: colors.tertiaryText,
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: radii.pill,
    backgroundColor: colors.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    ...typography.bodyStrong,
    color: colors.primaryText,
  },
  syncBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: SYNC_BADGE_SIZE,
    height: SYNC_BADGE_SIZE,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.background,
  },
  section: {
    gap: layout.blockGap,
  },
  sectionActions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  week: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  // `flexBasis: '48%'` com `flexWrap` produz a grade 2×2 sem medir a tela.
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  statsCell: {
    flexGrow: 1,
    flexBasis: '48%',
  },
  emptyRecent: {
    ...typography.footnote,
    color: colors.tertiaryText,
    paddingVertical: spacing.xs,
  },
  accountHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatarLarge: {
    width: AVATAR_SIZE_LARGE,
    height: AVATAR_SIZE_LARGE,
  },
  avatarInitialLarge: {
    ...typography.h2,
    color: colors.primaryText,
  },
  accountName: {
    ...typography.h3,
    color: colors.primaryText,
  },
  syncRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.card,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  syncDot: {
    width: spacing.xs,
    height: spacing.xs,
    borderRadius: radii.pill,
  },
  syncText: {
    ...typography.footnote,
    color: colors.secondaryText,
  },
});
