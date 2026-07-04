/**
 * lastPulledAt — Gerenciamento do cursor `last_pulled_at` para o Sync_Engine.
 *
 * Persiste o timestamp da última sincronização de pull bem-sucedida.
 * Quando nenhum cursor foi persistido (primeira sincronização), retorna null.
 *
 * Implementação atual: armazena em memória (substituir por AsyncStorage/WatermelonDB
 * localStorage em produção).
 */

let lastPulledAtValue: number | null = null;

/**
 * Retorna o cursor persistido ou null se nenhuma sincronização pull
 * foi concluída com sucesso até agora.
 */
export function loadLastPulledAt(): number | null {
  return lastPulledAtValue;
}

/**
 * Persiste o cursor após uma sincronização pull bem-sucedida.
 * Somente deve ser chamado depois que todas as mudanças do pull
 * foram aplicadas com sucesso ao WatermelonDB (Requisito 4.5).
 */
export function saveLastPulledAt(timestamp: number): void {
  lastPulledAtValue = timestamp;
}

/**
 * Limpa o cursor (ex.: no logout, para forçar full pull na próxima sessão).
 */
export function clearLastPulledAt(): void {
  lastPulledAtValue = null;
}
