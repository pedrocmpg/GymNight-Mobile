/**
 * useReactiveQuery — fundação genérica para observação reativa de dados do WatermelonDB.
 *
 * Encapsula o subscribe/unsubscribe de qualquer Observable compatível com o padrão
 * { subscribe(observer): { unsubscribe() } }, incluindo o .observe() do WatermelonDB
 * e do MockDatabaseAdapter.
 *
 * Comportamento:
 * - isLoading inicia true, e só passa a false na PRIMEIRA emissão bem-sucedida
 * - Se a observable emitir erro, descarta o último valor bem-sucedido e expõe APENAS error
 * - Dados de domínio NUNCA são copiados para Zustand/Context
 *
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.6
 */

import { useEffect, useRef, useState } from 'react';

/**
 * Interface mínima de Observable compatível com WatermelonDB e MockDatabaseAdapter.
 */
export interface ReactiveObservable<T> {
  subscribe(observer: {
    next?: (value: T) => void;
    error?: (err: unknown) => void;
    complete?: () => void;
  }): { unsubscribe: () => void };
}

/**
 * Resultado retornado pelo hook useReactiveQuery.
 */
export interface ReactiveQueryResult<T> {
  data: T | null;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Factory function type: produces an Observable to subscribe to.
 * Passed as a function so the hook can re-subscribe if deps change.
 */
export type ObservableFactory<T> = () => ReactiveObservable<T>;

/**
 * Hook genérico de observação reativa.
 *
 * @param factory - Função que retorna a Observable a ser observada.
 * @param deps - Dependências para re-subscribe (similar ao useEffect deps).
 * @returns { data, isLoading, error }
 */
export function useReactiveQuery<T>(
  factory: ObservableFactory<T>,
  deps: unknown[] = [],
): ReactiveQueryResult<T> {
  const [state, setState] = useState<ReactiveQueryResult<T>>({
    data: null,
    isLoading: true,
    error: null,
  });

  // Track whether we've received the first emission
  const hasEmittedRef = useRef(false);

  useEffect(() => {
    hasEmittedRef.current = false;

    // Reset to loading state on re-subscribe
    setState({ data: null, isLoading: true, error: null });

    let observable: ReactiveObservable<T>;
    try {
      observable = factory();
    } catch (err) {
      // Factory itself threw — treat as error
      setState({
        data: null,
        isLoading: false,
        error: err instanceof Error ? err : new Error(String(err)),
      });
      return;
    }

    const subscription = observable.subscribe({
      next: (value) => {
        hasEmittedRef.current = true;
        setState({
          data: value,
          isLoading: false,
          error: null,
        });
      },
      error: (err) => {
        // On error: discard any previously successful data (Requirement 1.6)
        setState({
          data: null,
          isLoading: false,
          error: err instanceof Error ? err : new Error(String(err)),
        });
      },
    });

    return () => {
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return state;
}
