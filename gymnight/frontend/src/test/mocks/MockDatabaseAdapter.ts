/**
 * MockDatabaseAdapter — substituto em memória do WatermelonDB para testes.
 *
 * Implementa a interface completa usada pelas telas e hooks:
 *   find, query (com filtragem), observe (reativo), create, update, markAsDeleted.
 *
 * Permite pre-seed de registros para qualquer uma das 6 tabelas sincronizáveis
 * (users, exercises, workouts, workout_exercises, workout_sessions, logged_sets).
 *
 * Diferente do mock básico em watermelondb.ts, este adapter:
 * - Emite notificações reativas via observe() ao criar/atualizar/deletar
 * - Suporta predicados de filtragem em query()
 * - Mantém tipagem genérica por coleção
 * - Simula o comportamento do WatermelonDB de forma mais fiel para testes de integração
 */

type Subscriber<T> = (records: T[]) => void;

/**
 * Nomes das 6 tabelas sincronizáveis do GymNight.
 */
export type SyncableTable =
  | 'users'
  | 'exercises'
  | 'workouts'
  | 'workout_exercises'
  | 'workout_sessions'
  | 'logged_sets';

/**
 * Interface base para registros armazenados no MockDatabaseAdapter.
 */
export interface MockRecord {
  id: string;
  [key: string]: unknown;
}

/**
 * Observable simplificada compatível com o padrão de subscribe/unsubscribe
 * usado pelos hooks de Reactive_Query do WatermelonDB.
 */
export interface MockObservable<T> {
  subscribe(observer: {
    next?: (value: T) => void;
    error?: (err: unknown) => void;
    complete?: () => void;
  }): { unsubscribe: () => void };
}

/**
 * Uma coleção em memória com tipagem genérica.
 * Cada instância representa uma das 6 tabelas do WatermelonDB.
 */
export class MockCollection<T extends MockRecord = MockRecord> {
  private records = new Map<string, T>();
  private subscribers = new Set<Subscriber<T>>();

  /**
   * Pré-popula a coleção com registros.
   * Pode ser chamado múltiplas vezes — registros com IDs duplicados são substituídos.
   */
  seed(records: T[]): void {
    for (const record of records) {
      this.records.set(record.id, record);
    }
  }

  /**
   * Busca um registro por ID.
   * Retorna undefined se não encontrado (não lança exceção).
   */
  find(id: string): T | undefined {
    return this.records.get(id);
  }

  /**
   * Filtra registros usando um predicado.
   * Sem predicado, retorna todos os registros da coleção.
   */
  query(predicate?: (record: T) => boolean): T[] {
    const all = [...this.records.values()];
    return predicate ? all.filter(predicate) : all;
  }

  /**
   * Observa a coleção de forma reativa.
   * Emite imediatamente o estado atual (filtrado pelo predicado, se fornecido)
   * e re-emite a cada mutação (create/update/markAsDeleted).
   */
  observe(predicate?: (record: T) => boolean): MockObservable<T[]> {
    return {
      subscribe: (observer) => {
        // Emissão inicial imediata
        const emit = () => {
          const all = [...this.records.values()];
          const filtered = predicate ? all.filter(predicate) : all;
          observer.next?.(filtered);
        };

        emit();

        // Registra subscriber para emissões futuras
        const subscriber: Subscriber<T> = () => emit();
        this.subscribers.add(subscriber);

        return {
          unsubscribe: () => {
            this.subscribers.delete(subscriber);
          },
        };
      },
    };
  }

  /**
   * Cria um novo registro na coleção.
   * Notifica todos os observers.
   */
  create(record: T): T {
    this.records.set(record.id, record);
    this.notify();
    return record;
  }

  /**
   * Atualiza um registro existente por ID (merge parcial).
   * Lança erro se o registro não existir.
   * Notifica todos os observers.
   */
  update(id: string, patch: Partial<T>): T {
    const existing = this.records.get(id);
    if (!existing) {
      throw new Error(`MockCollection: record with id "${id}" not found`);
    }
    const updated = { ...existing, ...patch } as T;
    this.records.set(id, updated);
    this.notify();
    return updated;
  }

  /**
   * Remove um registro por ID (simula markAsDeleted do WatermelonDB).
   * Lança erro se o registro não existir.
   * Notifica todos os observers.
   */
  markAsDeleted(id: string): void {
    if (!this.records.has(id)) {
      throw new Error(`MockCollection: record with id "${id}" not found`);
    }
    this.records.delete(id);
    this.notify();
  }

  /**
   * Retorna a quantidade de registros na coleção.
   */
  get count(): number {
    return this.records.size;
  }

  /**
   * Limpa toda a coleção. Útil para reset entre testes.
   */
  clear(): void {
    this.records.clear();
    this.notify();
  }

  private notify(): void {
    const all = [...this.records.values()];
    for (const subscriber of this.subscribers) {
      subscriber(all);
    }
  }
}

/**
 * MockDatabaseAdapter — ponto central que agrupa as 6 coleções.
 *
 * Uso em testes:
 * ```ts
 * const db = new MockDatabaseAdapter();
 * db.seed('logged_sets', [
 *   { id: '1', sessionId: 's1', exerciseId: 'e1', weight: 100, repetitions: 10, estimatedOneRm: 133.33 },
 * ]);
 * const sets = db.collection('logged_sets').query((r) => r.sessionId === 's1');
 * ```
 */
export class MockDatabaseAdapter {
  private collections = new Map<string, MockCollection<any>>();

  constructor() {
    // Inicializa as 6 tabelas sincronizáveis
    const tables: SyncableTable[] = [
      'users',
      'exercises',
      'workouts',
      'workout_exercises',
      'workout_sessions',
      'logged_sets',
    ];
    for (const table of tables) {
      this.collections.set(table, new MockCollection());
    }
  }

  /**
   * Retorna a coleção para uma determinada tabela.
   * Lança erro se a tabela não for uma das 6 definidas.
   */
  collection<T extends MockRecord = MockRecord>(table: string): MockCollection<T> {
    const coll = this.collections.get(table);
    if (!coll) {
      throw new Error(
        `MockDatabaseAdapter: table "${table}" not found. ` +
          `Available tables: ${[...this.collections.keys()].join(', ')}`,
      );
    }
    return coll as MockCollection<T>;
  }

  /**
   * Atalho: pré-popula registros em uma tabela específica.
   */
  seed<T extends MockRecord = MockRecord>(table: string, records: T[]): void {
    this.collection<T>(table).seed(records);
  }

  /**
   * Simula database.write() do WatermelonDB — executa a função de escrita e retorna o resultado.
   * No mock, não há transação real, mas garante interface compatível.
   */
  async write<R>(fn: () => Promise<R> | R): Promise<R> {
    return fn();
  }

  /**
   * Reseta todas as coleções. Útil em beforeEach/afterEach.
   */
  reset(): void {
    for (const coll of this.collections.values()) {
      coll.clear();
    }
  }
}
