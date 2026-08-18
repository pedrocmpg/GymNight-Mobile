import { endSessionWithPersistence } from '../endSessionWithPersistence';

describe('endSessionWithPersistence', () => {
  it('sets ended_at on the found record and returns success', async () => {
    let capturedRaw: any;
    const record = {
      update: async (updater: (r: any) => void) => {
        const raw: any = { _raw: {} };
        updater(raw);
        capturedRaw = raw._raw;
        return raw;
      },
    };
    const db = {
      write: async (fn: () => Promise<any>) => fn(),
      get: () => ({ find: async () => record }),
    } as any;

    const result = await endSessionWithPersistence('session-1', db);

    expect(result).toEqual({ success: true });
    expect(typeof capturedRaw.ended_at).toBe('number');
  });

  it('returns a failure result when the session cannot be found', async () => {
    const db = {
      write: async (fn: () => Promise<any>) => fn(),
      get: () => ({
        find: async () => {
          throw new Error('not found');
        },
      }),
    } as any;

    const result = await endSessionWithPersistence('missing-session', db);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toBe('not found');
    }
  });
});
