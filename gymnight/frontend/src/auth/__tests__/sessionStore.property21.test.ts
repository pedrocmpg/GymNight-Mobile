/**
 * Feature: frontend-backend-integration, Property 21: SessionProvider always reflects the most recent session-producing event, or null after logout
 * **Validates: Requirements 10.2**
 */
import * as fc from 'fast-check';
import { createSessionStore } from '../sessionStore';
import type { Session } from '../SecureStorage';

const arbNonEmptyString = fc.string({ minLength: 1, maxLength: 64 }).filter((s) => s.trim().length > 0);

const arbSession: fc.Arbitrary<Session> = fc.record({
  access_token: arbNonEmptyString,
  refresh_token: arbNonEmptyString,
  user_id: arbNonEmptyString,
});

type Event = { kind: 'produce'; session: Session } | { kind: 'logout' };

const arbEvent: fc.Arbitrary<Event> = fc.oneof(
  arbSession.map((session) => ({ kind: 'produce' as const, session })),
  fc.constant({ kind: 'logout' as const })
);

describe('Property 21: SessionProvider reflects the most recent session-producing event, or null after logout', () => {
  it('getCurrentSession() equals the last produced session, or null after a logout event', () => {
    fc.assert(
      fc.property(fc.array(arbEvent, { minLength: 0, maxLength: 20 }), (events) => {
        const store = createSessionStore();
        let expected: Session | null = null;

        for (const event of events) {
          if (event.kind === 'produce') {
            store.set(event.session);
            expected = event.session;
          } else {
            store.clear();
            expected = null;
          }
        }

        expect(store.getCurrentSession()).toEqual(expected);
      }),
      { numRuns: 100 }
    );
  });

  it('returns null before any session-producing event has occurred', () => {
    const store = createSessionStore();
    expect(store.getCurrentSession()).toBeNull();
  });
});
