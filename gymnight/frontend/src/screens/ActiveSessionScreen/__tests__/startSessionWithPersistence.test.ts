import { startSessionWithPersistence } from '../startSessionWithPersistence';

function makeFakeDb(createImpl: (recordBuilder: (r: any) => void) => any) {
  return {
    write: async (fn: () => Promise<any>) => fn(),
    get: () => ({ create: async (recordBuilder: (r: any) => void) => createImpl(recordBuilder) }),
  } as any;
}

describe('startSessionWithPersistence', () => {
  it('persists a workout_sessions record and returns its id on success', async () => {
    const db = makeFakeDb((recordBuilder) => {
      const raw: any = { _raw: {} };
      recordBuilder(raw);
      return { id: 'session-1', _raw: raw._raw };
    });

    const result = await startSessionWithPersistence('user-1', 'workout-1', db);

    expect(result).toEqual({ success: true, sessionId: 'session-1' });
  });

  it('sets workout_id to null for a freestyle session (no workoutId)', async () => {
    let capturedRaw: any;
    const db = makeFakeDb((recordBuilder) => {
      const raw: any = { _raw: {} };
      recordBuilder(raw);
      capturedRaw = raw._raw;
      return { id: 'session-2', _raw: raw._raw };
    });

    await startSessionWithPersistence('user-1', undefined, db);

    expect(capturedRaw.workout_id).toBeNull();
    expect(capturedRaw.ended_at).toBeNull();
  });

  it('returns a failure result when the write throws', async () => {
    const db = {
      write: async () => {
        throw new Error('disk full');
      },
      get: () => ({}),
    } as any;

    const result = await startSessionWithPersistence('user-1', 'workout-1', db);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toBe('disk full');
    }
  });
});
