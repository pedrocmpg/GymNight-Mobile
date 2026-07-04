/**
 * Session Lifecycle — funções puras para iniciar e encerrar WorkoutSessions.
 *
 * Estas funções NÃO interagem com WatermelonDB nem com a rede.
 * Elas produzem os dados estruturados que a camada de persistência consumirá.
 *
 * Validates: Requirements 19.1, 19.2, 19.4, 19.7
 */

import { computeEstimatedOneRm } from '../../hooks/domainUtils';

export interface SessionStartResult {
  id: string;
  user_id: string;
  workout_id: string | null;
  started_at: number; // Unix timestamp ms
  ended_at: null;
}

export interface SessionEndResult {
  id: string;
  user_id: string;
  workout_id: string | null;
  started_at: number;
  ended_at: number; // Unix timestamp ms
}

/**
 * Cria os dados para início de uma WorkoutSession.
 *
 * - `started_at` é sempre definido como o timestamp atual (Date.now()).
 * - `ended_at` é sempre null (sessão em andamento).
 * - `workout_id` é null para Freestyle_Session; caso contrário, recebe o valor fornecido.
 *
 * @param userId - ID do usuário autenticado
 * @param workoutId - ID do workout pré-definido (undefined para freestyle)
 * @param now - função que retorna timestamp atual (injeção para testabilidade)
 * @param idGenerator - função que gera um ID único (injeção para testabilidade)
 */
export function startSession(
  userId: string,
  workoutId?: string,
  now: () => number = Date.now,
  idGenerator: () => string = () => crypto.randomUUID?.() ?? `session-${Date.now()}`,
): SessionStartResult {
  return {
    id: idGenerator(),
    user_id: userId,
    workout_id: workoutId ?? null,
    started_at: now(),
    ended_at: null,
  };
}

/**
 * Calcula o tempo decorrido em milissegundos entre o início da sessão e o instante atual.
 *
 * Função pura: retorna exatamente `now - startedAt` sem arredondamento ou transformação.
 *
 * Validates: Requirements 19.3
 *
 * @param startedAt - Timestamp (ms) de início da sessão
 * @param now - Timestamp (ms) do instante atual
 * @returns Diferença em milissegundos (now - startedAt)
 */
export function computeElapsedTime(startedAt: number, now: number): number {
  return now - startedAt;
}

/**
 * Produz os dados de encerramento de uma WorkoutSession em andamento.
 *
 * - `ended_at` é definido como o timestamp atual (>= started_at).
 * - Todos os campos existentes são preservados.
 *
 * @param session - Sessão em andamento (com ended_at === null)
 * @param now - função que retorna timestamp atual (injeção para testabilidade)
 */
export function endSession(
  session: SessionStartResult,
  now: () => number = Date.now,
): SessionEndResult {
  return {
    id: session.id,
    user_id: session.user_id,
    workout_id: session.workout_id,
    started_at: session.started_at,
    ended_at: now(),
  };
}

// --- Resumable Sessions ---

/**
 * Determina se uma sessão é retomável (resumable).
 * Uma sessão é retomável se e somente se `ended_at === null`.
 *
 * Validates: Requirements 19.8
 *
 * @param session - Objeto com campo `ended_at` (null = em andamento, número = encerrada)
 * @returns true se a sessão é retomável (ended_at === null), false caso contrário
 */
export function isResumableSession(session: { ended_at: number | null }): boolean {
  return session.ended_at === null;
}

/**
 * Filtra uma lista de sessões, retornando apenas as retomáveis (ended_at === null).
 *
 * Validates: Requirements 19.8
 *
 * @param sessions - Array de sessões com `id` e `ended_at`
 * @returns Subconjunto contendo apenas sessões com `ended_at === null`
 */
export function filterResumableSessions<T extends { id: string; ended_at: number | null }>(
  sessions: T[],
): T[] {
  return sessions.filter((s) => s.ended_at === null);
}

// --- LoggedSet creation ---

export interface LoggedSetResult {
  session_id: string;
  exercise_id: string;
  weight: number;
  repetitions: number;
  estimated_one_rm: number;
  completed_at: number; // Unix timestamp ms
}

/**
 * Cria os dados para um LoggedSet vinculado à sessão e exercício correntes.
 *
 * - `session_id` e `exercise_id` são sempre definidos a partir dos parâmetros fornecidos.
 * - `completed_at` é sempre definido como o timestamp retornado por `now()` (nunca null).
 * - `estimated_one_rm` utiliza a Epley Formula quando nenhum valor explícito é fornecido;
 *   caso contrário, utiliza o valor explícito diretamente.
 *
 * Validates: Requirements 19.4
 *
 * @param sessionId - ID da WorkoutSession em andamento
 * @param exerciseId - ID do exercício selecionado
 * @param weight - Peso utilizado na série (> 0)
 * @param repetitions - Número de repetições (>= 1)
 * @param explicitOneRm - Valor explícito de 1RM (opcional; bypass da Epley Formula)
 * @param now - função que retorna timestamp atual (injeção para testabilidade)
 */
export function createLoggedSet(
  sessionId: string,
  exerciseId: string,
  weight: number,
  repetitions: number,
  explicitOneRm?: number,
  now: () => number = Date.now,
): LoggedSetResult {
  return {
    session_id: sessionId,
    exercise_id: exerciseId,
    weight,
    repetitions,
    estimated_one_rm: computeEstimatedOneRm(weight, repetitions, explicitOneRm),
    completed_at: now(),
  };
}

// --- LoggedSet persistence with error isolation ---

export interface LoggedSetPersistSuccess {
  success: true;
  id: string;
}

export interface LoggedSetPersistFailure {
  success: false;
  error: string;
  retainedValues: {
    weight: number;
    reps: number;
    exerciseId: string;
  };
}

export type LoggedSetPersistResult = LoggedSetPersistSuccess | LoggedSetPersistFailure;

/**
 * Tenta persistir um LoggedSet de forma isolada.
 *
 * - Em caso de sucesso: retorna `{ success: true, id }`.
 * - Em caso de falha: retorna `{ success: false, error, retainedValues }`.
 *   O erro é isolado a ESTE entry — outras entradas NÃO são afetadas.
 *   Os valores inseridos pelo usuário são retidos para permitir retry sem re-digitação.
 * - Nenhuma escrita parcial ocorre em caso de falha (operação atômica por entry).
 *
 * Validates: Requirements 19.10
 *
 * @param entry - Dados do LoggedSet a persistir (exerciseId, weight, reps, sessionId)
 * @param persist - Função de persistência injetável (abstraí WatermelonDB `database.write`)
 * @returns Resultado indicando sucesso com ID ou falha com valores retidos
 */
export async function persistLoggedSetWithIsolation(
  entry: { exerciseId: string; weight: number; reps: number; sessionId: string },
  persist: (data: { exerciseId: string; weight: number; reps: number; sessionId: string }) => Promise<string>,
): Promise<LoggedSetPersistResult> {
  try {
    const id = await persist(entry);
    return { success: true, id };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: errorMessage,
      retainedValues: {
        weight: entry.weight,
        reps: entry.reps,
        exerciseId: entry.exerciseId,
      },
    };
  }
}

/**
 * Persiste múltiplos LoggedSets de forma isolada. A falha em um entry NÃO afeta os demais.
 * Cada entry é processado independentemente, garantindo que:
 * - Entries bem-sucedidos retornam `{ success: true, id }`
 * - Entries falhados retornam `{ success: false, error, retainedValues }`
 * - Nenhuma falha em um entry impede o sucesso de outros
 *
 * Validates: Requirements 19.10
 *
 * @param entries - Array de dados de LoggedSet a persistir
 * @param persist - Função de persistência injetável (chamada individualmente por entry)
 * @returns Array de resultados, um para cada entry, na mesma ordem
 */
export async function persistMultipleLoggedSetsWithIsolation(
  entries: Array<{ exerciseId: string; weight: number; reps: number; sessionId: string }>,
  persist: (data: { exerciseId: string; weight: number; reps: number; sessionId: string }) => Promise<string>,
): Promise<LoggedSetPersistResult[]> {
  return Promise.all(
    entries.map((entry) => persistLoggedSetWithIsolation(entry, persist)),
  );
}
