/**
 * pullRequest — Construção da URL de pull para o Sync_Engine.
 *
 * Implementa Requisito 4.2: se nenhum `last_pulled_at` foi persistido,
 * a URL NÃO inclui o parâmetro (primeira sincronização).
 *
 * Implementa Requisito 4.3: se um valor existe, é enviado exatamente
 * como `?last_pulled_at=<valor>`.
 */

/**
 * Constrói a URL completa para o pull request.
 *
 * @param baseUrl - URL base do endpoint de pull (ex.: "https://api.gymnight.app/api/v1/sync/pull")
 * @param lastPulledAt - Cursor persistido ou null (primeira sync)
 * @returns URL sem o parâmetro quando lastPulledAt é null; com `?last_pulled_at=<valor>` caso contrário
 */
export function buildPullUrl(baseUrl: string, lastPulledAt: number | null): string {
  if (lastPulledAt === null || lastPulledAt === undefined) {
    return baseUrl;
  }

  return `${baseUrl}?last_pulled_at=${lastPulledAt}`;
}
