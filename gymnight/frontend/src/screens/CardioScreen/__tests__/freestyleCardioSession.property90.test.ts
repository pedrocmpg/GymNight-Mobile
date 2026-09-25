/**
 * Property-Based Test — Property 90
 *
 * Sessão avulsa de cardio: `startSession` sem `workoutId` produz
 * `workout_id: null` (mesmo mecanismo de freestyle da Wave 4 — "Isso já é
 * suportado", PARIDADE-05-CARDIO.md §4.3); `createCardioLog` referencia essa
 * sessão; `endSession` a encerra normalmente, sem exigir workout algum.
 */
import * as fc from 'fast-check';
import { startSession, endSession, createCardioLog } from '../../ActiveSessionScreen/sessionLifecycle';

describe('Property 90: cardio avulso cria sessão com workout_id nulo e a encerra', () => {
  it('startSession sem workoutId sempre produz workout_id null', () => {
    fc.assert(
      fc.property(fc.uuid(), (userId) => {
        const session = startSession(userId, undefined, () => 1000, () => 'session-1');
        return session.workout_id === null && session.ended_at === null;
      }),
      { numRuns: 100 },
    );
  });

  it('createCardioLog referencia a sessão avulsa recém-criada', () => {
    const session = startSession('user-1', undefined, () => 1000, () => 'session-1');
    const cardioLog = createCardioLog(
      session.id,
      { cardioType: 'Corrida Contínua (Trote)', durationMin: 30, distanceKm: 5, pse: 7 },
      () => 2000,
    );
    expect(cardioLog.session_id).toBe(session.id);
    expect(cardioLog.cardio_type).toBe('Corrida Contínua (Trote)');
    expect(cardioLog.duration_min).toBe(30);
    expect(cardioLog.distance_km).toBe(5);
    expect(cardioLog.pse).toBe(7);
  });

  it('distância ausente vira null no CardioLog, não undefined nem 0', () => {
    const session = startSession('user-1', undefined);
    const cardioLog = createCardioLog(session.id, {
      cardioType: 'Caminhada ao ar livre',
      durationMin: 45,
      distanceKm: null,
      pse: 3,
    });
    expect(cardioLog.distance_km).toBeNull();
  });

  it('endSession encerra a sessão avulsa normalmente — workout_id continua null, ended_at é preenchido', () => {
    fc.assert(
      fc.property(fc.uuid(), fc.integer({ min: 0, max: 10_000_000 }), (userId, elapsedMs) => {
        const started = startSession(userId, undefined, () => 1000);
        const ended = endSession(started, () => 1000 + elapsedMs);
        return ended.workout_id === null && ended.ended_at === 1000 + elapsedMs && ended.id === started.id;
      }),
      { numRuns: 100 },
    );
  });

  it('sessão COM workout (treino normal) nunca tem workout_id null — contraste de sanidade', () => {
    const session = startSession('user-1', 'workout-1', () => 1000, () => 'session-1');
    expect(session.workout_id).toBe('workout-1');
  });
});
