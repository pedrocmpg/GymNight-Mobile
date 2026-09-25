/**
 * combineMany — combinador N-ário genérico introduzido na Wave 7
 * (PARIDADE-03-ESTATISTICAS.md §6) para useObserveStatistics, no lugar de
 * aninhar mais um nível de combineObservables binário. Mesmos invariantes dos
 * combinadores ad-hoc existentes (combineObservables em useObserveDashboard,
 * combineHistoryObservables em useObserveHistory): só emite quando TODAS as
 * fontes já emitiram ao menos uma vez, re-emite a cada mudança, e erro em
 * qualquer fonte propaga e trava emissões futuras.
 */
import { combineMany, type ReactiveObservable } from '@/hooks/useReactiveQuery';

interface TestObservable<T> extends ReactiveObservable<T> {
  emit: (value: T) => void;
  emitError: (err: unknown) => void;
  unsubscribeCount: number;
}

function makeTestObservable<T>(): TestObservable<T> {
  let observer: { next?: (v: T) => void; error?: (e: unknown) => void } | null = null;
  const obs: TestObservable<T> = {
    subscribe(o) {
      observer = o;
      return {
        unsubscribe: () => {
          obs.unsubscribeCount += 1;
        },
      };
    },
    emit: (value) => observer?.next?.(value),
    emitError: (err) => observer?.error?.(err),
    unsubscribeCount: 0,
  };
  return obs;
}

describe('combineMany', () => {
  it('does not emit until every source has emitted at least once', () => {
    const a = makeTestObservable<number>();
    const b = makeTestObservable<string>();
    const c = makeTestObservable<boolean>();
    const results: unknown[] = [];

    combineMany([a, b, c] as const).subscribe({ next: (v) => results.push(v) });

    a.emit(1);
    expect(results).toHaveLength(0);
    b.emit('x');
    expect(results).toHaveLength(0);
    c.emit(true);
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual([1, 'x', true]);
  });

  it('re-emits, preserving the latest value of the other sources, whenever any one source changes', () => {
    const a = makeTestObservable<number>();
    const b = makeTestObservable<number>();
    const results: unknown[] = [];

    combineMany([a, b] as const).subscribe({ next: (v) => results.push(v) });
    a.emit(1);
    b.emit(10);
    a.emit(2);
    b.emit(20);

    expect(results).toEqual([
      [1, 10],
      [2, 10],
      [2, 20],
    ]);
  });

  it('preserves the order of the input observables in the emitted tuple', () => {
    const a = makeTestObservable<string>();
    const b = makeTestObservable<string>();
    const c = makeTestObservable<string>();
    const results: unknown[] = [];

    combineMany([a, b, c] as const).subscribe({ next: (v) => results.push(v) });
    a.emit('a');
    b.emit('b');
    c.emit('c');

    expect(results[0]).toEqual(['a', 'b', 'c']);
  });

  it('propagates an error from any single source immediately', () => {
    const a = makeTestObservable<number>();
    const b = makeTestObservable<number>();
    const errors: unknown[] = [];

    combineMany([a, b] as const).subscribe({ error: (e) => errors.push(e) });
    a.emit(1);
    b.emitError(new Error('boom'));

    expect(errors).toHaveLength(1);
  });

  it('stops emitting after an error, even if a source later emits a valid value', () => {
    const a = makeTestObservable<number>();
    const b = makeTestObservable<number>();
    const results: unknown[] = [];
    const errors: unknown[] = [];

    combineMany([a, b] as const).subscribe({
      next: (v) => results.push(v),
      error: (e) => errors.push(e),
    });
    a.emit(1);
    b.emit(2);
    expect(results).toHaveLength(1);

    a.emitError('failure');
    b.emit(3);

    expect(errors).toHaveLength(1);
    expect(results).toHaveLength(1);
  });

  it('unsubscribing the combined observable unsubscribes every source', () => {
    const a = makeTestObservable<number>();
    const b = makeTestObservable<number>();
    const c = makeTestObservable<number>();

    const subscription = combineMany([a, b, c] as const).subscribe({});
    subscription.unsubscribe();

    expect(a.unsubscribeCount).toBe(1);
    expect(b.unsubscribeCount).toBe(1);
    expect(c.unsubscribeCount).toBe(1);
  });

  it('works with a single source (n=1), degenerating to a 1-tuple', () => {
    const a = makeTestObservable<string>();
    const results: unknown[] = [];

    combineMany([a] as const).subscribe({ next: (v) => results.push(v) });
    a.emit('only');

    expect(results).toEqual([['only']]);
  });
});
