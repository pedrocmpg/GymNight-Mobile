/**
 * SyncEngine — Orquestração do ciclo de sincronização (push → pull).
 *
 * Expõe `requestSyncCycle()` como ponto de entrada único para todos os gatilhos:
 * - Transição de conectividade estável offline→online (2s debounce) [Requisito 3.2]
 * - Timer fixo de 30s em foreground+online [Requisito 4.7]
 * - Ação manual do usuário
 *
 * Mecanismo de lock anti-concorrência (Requisito 4.8):
 * Se um ciclo já estiver em andamento, chamadas subsequentes são ignoradas (não enfileiradas).
 * Após o ciclo completar, o próximo gatilho pode iniciar um novo ciclo normalmente.
 */

export type SyncCycleRunner = () => Promise<void>;

export class SyncEngine {
  private cycleInProgress = false;
  private _cyclesCompleted = 0;
  private _runSyncCycle: SyncCycleRunner;

  constructor(runSyncCycle: SyncCycleRunner) {
    this._runSyncCycle = runSyncCycle;
  }

  /**
   * Indica se um ciclo de sincronização está em andamento.
   */
  get isCycleInProgress(): boolean {
    return this.cycleInProgress;
  }

  /**
   * Número total de ciclos concluídos com sucesso (para diagnóstico/testes).
   */
  get cyclesCompleted(): number {
    return this._cyclesCompleted;
  }

  /**
   * Ponto de entrada para todos os gatilhos de sincronização.
   *
   * - Se um ciclo já está em andamento, retorna imediatamente sem iniciar outro.
   * - Caso contrário, adquire o lock, executa o ciclo, e libera o lock no finally.
   *
   * Cada chamada a requestSyncCycle dispara NO MÁXIMO um ciclo de sincronização.
   */
  async requestSyncCycle(): Promise<void> {
    if (this.cycleInProgress) return;
    this.cycleInProgress = true;
    try {
      await this._runSyncCycle();
      this._cyclesCompleted++;
    } finally {
      this.cycleInProgress = false;
    }
  }

  /**
   * Reseta contadores internos (útil para testes).
   */
  reset(): void {
    this._cyclesCompleted = 0;
    this.cycleInProgress = false;
  }
}
