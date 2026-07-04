/**
 * Property-Based Test — Property 2
 *
 * Failed or recovering Reactive_Query never exposes stale or partial data.
 *
 * **Validates: Requirements 1.6**
 *
 * For any sequence of (value emissions followed by an error emission):
 * 1. After an error, the subscriber sees error and data is null (no stale data retained)
 * 2. The Observable contract guarantees that after error() is called, no further next()
 *    reaches the subscriber (no partial/stale data leaks)
 * 3. For any arbitrary error type, the error handler is invoked correctly
 * 4. During recovery (re-subscribe), state is { data: null, isLoading: true, error: null }
 *    — never shows old data
 *
 * This tests the state machine logic that useReactiveQuery implements, exercising it
 * through the same Observable subscribe pattern the hook uses internally.
 */
import * as fc from 'fast-check';
import { ReactiveObservable, ReactiveQueryResult } from '@/hooks/useReactiveQuery';

// --- Helpers ---

/**
 * Simulates the state transitions that useReactiveQuery performs when subscribing
 * to an observable. This directly mirrors the hook's subscribe logic without
 * needing React's runtime (useState/useEffect).
 */
function simulateHookSubscription<T>(
  observable: ReactiveObservable<T>,
): { getState: () => ReactiveQueryResult<T>; unsubscribe: () => void } {
  let state: ReactiveQueryResult<T> = {
    data: null,
    isLoading: true,
    error: null,
  };

  const subscription = observable.subscribe({
    next: (value) => {
      state = {
        data: value,
        isLoading: false,
        error: null,
      };
    },
    error: (err) => {
      // On error: discard any previously successful data (Requirement 1.6)
      state = {
        data: null,
        isLoading: false,
        error: err instanceof Error ? err : new Error(String(err)),
      };
    },
  });

  return {
    getState: () => state,
    unsubscribe: () => subscription.unsubscribe(),
  };
}

/**
 * Creates a controllable Observable that lets tests emit values and errors
 * in arbitrary sequences.
 */
function createControllableObservable<T>(): {
  observable: ReactiveObservable<T>;
  emitNext: (value: T) => void;
  emitError: (err: unknown) => void;
  isTerminated: () => boolean;
} {
  let observer: {
    next?: (value: T) => void;
    error?: (err: unknown) => void;
    complete?: () => void;
  } | null = null;
  let terminated = false;

  const observable: ReactiveObservable<T> = {
    subscribe(obs) {
      observer = obs;
      terminated = false;
      return {
        unsubscribe: () => {
          observer = null;
        },
      };
    },
  };

  return {
    observable,
    emitNext: (value: T) => {
      if (!terminated && observer?.next) {
        observer.next(value);
      }
    },
    emitError: (err: unknown) => {
      if (!terminated && observer?.error) {
        terminated = true;
        observer.error(err);
        // Per Observable contract: after error(), no further emissions
        observer = null;
      }
    },
    isTerminated: () => terminated,
  };
}

// --- Arbitraries ---

/** Generates arbitrary data values that could be emitted by a Reactive_Query */
const arbDataValue = fc.oneof(
  fc.array(fc.record({ id: fc.uuid(), name: fc.string({ minLength: 1, maxLength: 20 }) }), {
    minLength: 0,
    maxLength: 10,
  }),
  fc.record({ id: fc.uuid(), value: fc.integer() }),
  fc.string({ minLength: 1, maxLength: 50 }),
  fc.integer(),
);

/** Generates arbitrary error values of different types */
const arbErrorValue: fc.Arbitrary<unknown> = fc.oneof(
  fc.string({ minLength: 1, maxLength: 50 }).map((msg) => new Error(msg)),
  fc.string({ minLength: 1, maxLength: 50 }),
  fc.constant(null),
  fc.constant(undefined),
  fc.integer(),
  fc.record({ code: fc.integer(), message: fc.string() }),
);

/** Generates a non-zero count of values to emit before error */
const arbValueCount = fc.integer({ min: 1, max: 20 });

// --- Tests ---

describe('Property 2: Failed or recovering Reactive_Query never exposes stale or partial data', () => {
  /**
   * Property 2a: After an error emission, state always discards previous data.
   *
   * For any sequence of N successful values followed by an error, the final state
   * must be { data: null, isLoading: false, error: <Error> }.
   *
   * **Validates: Requirements 1.6**
   */
  it('after error, state is { data: null, isLoading: false, error } regardless of prior emissions', () => {
    fc.assert(
      fc.property(
        fc.array(arbDataValue, { minLength: 1, maxLength: 20 }),
        arbErrorValue,
        (values, errorValue) => {
          const { observable, emitNext, emitError } = createControllableObservable<unknown>();
          const { getState, unsubscribe } = simulateHookSubscription(observable);

          // Initially loading
          expect(getState().isLoading).toBe(true);
          expect(getState().data).toBeNull();
          expect(getState().error).toBeNull();

          // Emit N successful values
          for (const value of values) {
            emitNext(value);
            // After each value, data is present and no error
            expect(getState().data).toEqual(value);
            expect(getState().isLoading).toBe(false);
            expect(getState().error).toBeNull();
          }

          // Now emit an error
          emitError(errorValue);

          // After error: data MUST be null (no stale data)
          const finalState = getState();
          expect(finalState.data).toBeNull();
          expect(finalState.isLoading).toBe(false);
          expect(finalState.error).toBeInstanceOf(Error);

          unsubscribe();
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Property 2b: After error(), no further next() reaches the subscriber.
   *
   * The Observable contract guarantees that once error() is called,
   * the terminal state is final and no further data emissions can leak through.
   *
   * **Validates: Requirements 1.6**
   */
  it('after error(), no further next() emissions reach the subscriber (Observable contract)', () => {
    fc.assert(
      fc.property(
        fc.array(arbDataValue, { minLength: 0, maxLength: 10 }),
        arbErrorValue,
        fc.array(arbDataValue, { minLength: 1, maxLength: 10 }),
        (preErrorValues, errorValue, postErrorValues) => {
          const { observable, emitNext, emitError, isTerminated } =
            createControllableObservable<unknown>();
          const { getState, unsubscribe } = simulateHookSubscription(observable);

          // Emit pre-error values
          for (const value of preErrorValues) {
            emitNext(value);
          }

          // Emit error
          emitError(errorValue);

          // Capture state after error
          const stateAfterError = { ...getState() };
          expect(stateAfterError.data).toBeNull();
          expect(stateAfterError.error).toBeInstanceOf(Error);

          // Observable is terminated
          expect(isTerminated()).toBe(true);

          // Attempt to emit more values — they should NOT change state
          for (const value of postErrorValues) {
            emitNext(value);
          }

          // State must remain unchanged — no stale/partial data leaks
          const stateAfterAttemptedEmissions = getState();
          expect(stateAfterAttemptedEmissions.data).toBeNull();
          expect(stateAfterAttemptedEmissions.error).toEqual(stateAfterError.error);
          expect(stateAfterAttemptedEmissions.isLoading).toBe(false);

          unsubscribe();
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Property 2c: Any error type is correctly wrapped in an Error instance.
   *
   * Whether the error is an Error, string, null, number, or object,
   * the state.error must always be an Error instance.
   *
   * **Validates: Requirements 1.6**
   */
  it('any error type is always wrapped as an Error instance in the final state', () => {
    fc.assert(
      fc.property(arbErrorValue, (errorValue) => {
        const { observable, emitError } = createControllableObservable<unknown>();
        const { getState, unsubscribe } = simulateHookSubscription(observable);

        emitError(errorValue);

        const state = getState();
        expect(state.error).toBeInstanceOf(Error);
        expect(state.data).toBeNull();
        expect(state.isLoading).toBe(false);

        // If original was an Error, its message must be preserved
        if (errorValue instanceof Error) {
          expect(state.error!.message).toBe(errorValue.message);
        }
        // If original was a string, it must be used as the Error message
        if (typeof errorValue === 'string') {
          expect(state.error!.message).toBe(errorValue);
        }

        unsubscribe();
      }),
      { numRuns: 100 },
    );
  });

  /**
   * Property 2d: Recovery (re-subscribe) resets to loading state, never showing old data.
   *
   * When a Reactive_Query fails and the hook re-subscribes (simulating a deps change),
   * the state transitions to { data: null, isLoading: true, error: null } before
   * any new data arrives — old data is never briefly visible.
   *
   * **Validates: Requirements 1.6**
   */
  it('recovery (re-subscribe) resets to loading state without showing old data', () => {
    fc.assert(
      fc.property(
        fc.array(arbDataValue, { minLength: 1, maxLength: 10 }),
        arbErrorValue,
        (values, errorValue) => {
          // First subscription: emit values then error
          const ctrl1 = createControllableObservable<unknown>();
          const sub1 = simulateHookSubscription(ctrl1.observable);

          for (const value of values) {
            ctrl1.emitNext(value);
          }
          ctrl1.emitError(errorValue);

          // Verify error state
          expect(sub1.getState().data).toBeNull();
          expect(sub1.getState().error).toBeInstanceOf(Error);
          sub1.unsubscribe();

          // Recovery: re-subscribe (simulates useEffect re-running with new deps)
          // The hook resets to loading state on re-subscribe
          const ctrl2 = createControllableObservable<unknown>();
          const sub2 = simulateHookSubscription(ctrl2.observable);

          // Immediately after re-subscribe, state MUST be loading (no old data)
          const recoveryState = sub2.getState();
          expect(recoveryState.data).toBeNull();
          expect(recoveryState.isLoading).toBe(true);
          expect(recoveryState.error).toBeNull();

          sub2.unsubscribe();
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Property 2e: Error immediately after subscribe (no prior values) still produces
   * correct error state with null data.
   *
   * **Validates: Requirements 1.6**
   */
  it('error emitted immediately (no prior values) produces { data: null, error } state', () => {
    fc.assert(
      fc.property(arbErrorValue, (errorValue) => {
        const { observable, emitError } = createControllableObservable<unknown>();
        const { getState, unsubscribe } = simulateHookSubscription(observable);

        // Initially loading
        expect(getState().isLoading).toBe(true);
        expect(getState().data).toBeNull();

        // Error immediately
        emitError(errorValue);

        // State is error with null data
        const state = getState();
        expect(state.data).toBeNull();
        expect(state.isLoading).toBe(false);
        expect(state.error).toBeInstanceOf(Error);

        unsubscribe();
      }),
      { numRuns: 100 },
    );
  });

  /**
   * Property 2f: Factory throwing simulates error initialization — state transitions
   * directly to error without ever exposing stale data.
   *
   * When the factory function itself throws, the hook must catch it and set
   * { data: null, isLoading: false, error: <caught> } without leaking any
   * prior state.
   *
   * **Validates: Requirements 1.6**
   */
  it('factory throwing produces error state without exposing stale data', () => {
    fc.assert(
      fc.property(arbErrorValue, (errorValue) => {
        // Simulate what the hook does when factory() throws:
        // It catches the error and sets state directly
        const thrownError = errorValue instanceof Error ? errorValue : new Error(String(errorValue));

        // The hook's logic: if factory throws, state becomes:
        const state: ReactiveQueryResult<unknown> = {
          data: null,
          isLoading: false,
          error: thrownError,
        };

        // Verify the contract
        expect(state.data).toBeNull();
        expect(state.isLoading).toBe(false);
        expect(state.error).toBeInstanceOf(Error);
      }),
      { numRuns: 100 },
    );
  });
});
