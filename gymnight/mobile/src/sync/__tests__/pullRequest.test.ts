/**
 * Unit test — Primeira sincronização sem `last_pulled_at`
 *
 * Valida Requisito 4.2:
 * "IF the Sync_Engine has never successfully persisted a `last_pulled_at` value,
 *  THEN THE Sync_Engine SHALL execute the pull request against GET /api/v1/sync/pull
 *  without the `last_pulled_at` query parameter, treating it as a first synchronization cycle."
 *
 * Também valida Requisito 4.3 (quando o cursor existe, o parâmetro é incluído).
 */

import { buildPullUrl } from '../pullRequest';
import { loadLastPulledAt, saveLastPulledAt, clearLastPulledAt } from '../lastPulledAt';

const BASE_URL = 'https://api.gymnight.app/api/v1/sync/pull';

describe('buildPullUrl', () => {
  describe('primeira sincronização (sem last_pulled_at persistido)', () => {
    it('deve omitir completamente o parâmetro last_pulled_at quando o cursor é null', () => {
      const url = buildPullUrl(BASE_URL, null);

      expect(url).toBe(BASE_URL);
      expect(url).not.toContain('last_pulled_at');
      expect(url).not.toContain('?');
    });

    it('não deve enviar last_pulled_at como "null" string', () => {
      const url = buildPullUrl(BASE_URL, null);

      expect(url).not.toContain('null');
    });

    it('não deve enviar last_pulled_at como "undefined" string', () => {
      const url = buildPullUrl(BASE_URL, null);

      expect(url).not.toContain('undefined');
    });

    it('não deve enviar last_pulled_at como 0', () => {
      const url = buildPullUrl(BASE_URL, null);

      expect(url).not.toContain('=0');
    });
  });

  describe('sincronização incremental (com last_pulled_at persistido)', () => {
    it('deve incluir ?last_pulled_at=<valor> quando cursor existe', () => {
      const timestamp = 1700000000000;
      const url = buildPullUrl(BASE_URL, timestamp);

      expect(url).toBe(`${BASE_URL}?last_pulled_at=${timestamp}`);
    });

    it('deve enviar o valor exato do timestamp persistido', () => {
      const timestamp = 1718234567890;
      const url = buildPullUrl(BASE_URL, timestamp);

      expect(url).toContain(`last_pulled_at=${timestamp}`);
    });
  });
});

describe('lastPulledAt - gerenciamento de cursor', () => {
  beforeEach(() => {
    clearLastPulledAt();
  });

  it('deve retornar null quando nenhum cursor foi persistido', () => {
    expect(loadLastPulledAt()).toBeNull();
  });

  it('deve retornar o valor persistido após saveLastPulledAt', () => {
    const timestamp = 1700000000000;
    saveLastPulledAt(timestamp);

    expect(loadLastPulledAt()).toBe(timestamp);
  });

  it('deve retornar null após clearLastPulledAt', () => {
    saveLastPulledAt(1700000000000);
    clearLastPulledAt();

    expect(loadLastPulledAt()).toBeNull();
  });

  describe('integração com buildPullUrl', () => {
    it('deve produzir URL sem parâmetro quando loadLastPulledAt retorna null', () => {
      const lastPulledAt = loadLastPulledAt();
      const url = buildPullUrl(BASE_URL, lastPulledAt);

      expect(url).toBe(BASE_URL);
      expect(url).not.toContain('last_pulled_at');
    });

    it('deve produzir URL com parâmetro quando loadLastPulledAt retorna um valor', () => {
      const timestamp = 1718234567890;
      saveLastPulledAt(timestamp);

      const lastPulledAt = loadLastPulledAt();
      const url = buildPullUrl(BASE_URL, lastPulledAt);

      expect(url).toBe(`${BASE_URL}?last_pulled_at=${timestamp}`);
    });
  });
});
