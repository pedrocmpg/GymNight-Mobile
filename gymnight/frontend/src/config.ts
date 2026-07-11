/**
 * Configuração centralizada da aplicação.
 * 
 * Use variáveis de ambiente ou constantes para:
 * - Backend API URL
 * - Supabase config
 * - Debug flags
 * 
 * Para device via USB: defina BACKEND_URL como seu IP local (ex: 192.168.1.100)
 * Para emulador: pode deixar localhost
 */

// ============================================================================
// BACKEND CONFIG
// ============================================================================

/**
 * URL base do backend FastAPI.
 * 
 * IMPORTANTE: Altere para o IP local do seu PC quando rodar no device.
 * Exemplo: 'http://192.168.1.100:8000'
 * 
 * Para descobrir seu IP:
 * $ hostname -I
 */
export const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';

/**
 * Endpoints de sincronização (WatermelonDB Sync Protocol v1)
 */
export const SYNC_PULL_URL = `${BACKEND_URL}/api/v1/sync/pull`;
export const SYNC_PUSH_URL = `${BACKEND_URL}/api/v1/sync/push`;

/**
 * Endpoint de health check (verificar conectividade)
 */
export const HEALTH_URL = `${BACKEND_URL}/health`;

// ============================================================================
// SUPABASE CONFIG
// ============================================================================

/**
 * URL do projeto Supabase
 * Exemplo: 'https://abc123.supabase.co'
 */
export const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL || '';

/**
 * Chave anônima do Supabase (pública, segura usar no frontend)
 */
export const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY || '';

// ============================================================================
// DEBUG & LOGGING
// ============================================================================

/**
 * Ativa logs detalhados de sincronização
 */
export const DEBUG_SYNC = process.env.REACT_APP_DEBUG_SYNC === 'true';

/**
 * Ativa logs detalhados de autenticação
 */
export const DEBUG_AUTH = process.env.REACT_APP_DEBUG_AUTH === 'true';

/**
 * Ativa logs detalhados de banco de dados
 */
export const DEBUG_DB = process.env.REACT_APP_DEBUG_DB === 'true';

// ============================================================================
// SYNC TIMINGS
// ============================================================================

/**
 * Intervalo em ms para ciclos automáticos de sincronização em foreground.
 * Padrão: 30s (de acordo com Requisito 4.7 da spec)
 */
export const SYNC_CYCLE_INTERVAL = 30_000;

/**
 * Debounce em ms para transição de conectividade (offline → online).
 * Padrão: 2s (de acordo com Requisito 3.2 da spec)
 */
export const CONNECTIVITY_DEBOUNCE = 2_000;

// ============================================================================
// NETWORK TIMEOUTS
// ============================================================================

/**
 * Timeout para requisições de sync (pull + push)
 */
export const SYNC_REQUEST_TIMEOUT = 30_000; // 30 segundos

/**
 * Timeout para autenticação (login, token refresh, etc)
 */
export const AUTH_REQUEST_TIMEOUT = 10_000; // 10 segundos

// ============================================================================
// VALIDATION
// ============================================================================

export function validateConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!SUPABASE_URL) {
    errors.push('REACT_APP_SUPABASE_URL não está configurado');
  }

  if (!SUPABASE_ANON_KEY) {
    errors.push('REACT_APP_SUPABASE_ANON_KEY não está configurado');
  }

  // Aviso (não erro) se usar localhost em produção
  if (BACKEND_URL.includes('localhost') && process.env.NODE_ENV === 'production') {
    errors.push(
      'BACKEND_URL ainda aponta para localhost em produção. ' +
        'Use seu IP local (hostname -I) ou domínio público.'
    );
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
