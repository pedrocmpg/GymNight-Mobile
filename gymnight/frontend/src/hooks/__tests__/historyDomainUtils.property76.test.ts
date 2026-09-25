/**
 * Property-Based Test — Property 76
 *
 * computeSmaDelta: dois guardas, ambos retornando 0 — histórico vazio (sem
 * sessões anteriores) e média histórica 0 (nunca fez o exercício com carga).
 *
 * Feature: PARIDADE-03-ESTATISTICAS.md §4.1
 */
import * as fc from 'fast-check';
import { computeSmaDelta, type SessionVolumePoint } from '@/hooks/historyDomainUtils';

describe('Property 76: computeSmaDelta — guardas de histórico vazio e média 0', () => {
  it('histórico vazio (só a sessão atual) sempre retorna 0, qualquer que seja o volume atual', () => {
    fc.assert(
      fc.property(fc.float({ min: 0, max: Math.fround(100000), noNaN: true }), (currentVolume) => {
        const sessions: SessionVolumePoint[] = [
          { sessionId: 'current', startedAt: 100, volume: currentVolume },
        ];
        return computeSmaDelta(sessions, 'current') === 0;
      }),
      { numRuns: 100 },
    );
  });

  it('média histórica 0 (todas as sessões anteriores com volume 0) sempre retorna 0', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 1, max: 99 }), { minLength: 1, maxLength: 5 }),
        fc.float({ min: 0, max: Math.fround(100000), noNaN: true }),
        (startedAts, currentVolume) => {
          const sessions: SessionVolumePoint[] = [
            ...startedAts.map((t, i) => ({ sessionId: `prev-${i}`, startedAt: t, volume: 0 })),
            { sessionId: 'current', startedAt: 100, volume: currentVolume },
          ];
          return computeSmaDelta(sessions, 'current') === 0;
        },
      ),
      { numRuns: 100 },
    );
  });

  it('sessão atual não encontrada na lista trata o volume atual como 0 (nunca lança)', () => {
    const sessions: SessionVolumePoint[] = [
      { sessionId: 'prev-1', startedAt: 100, volume: 50 },
    ];
    expect(() => computeSmaDelta(sessions, 'nao-existe')).not.toThrow();
    expect(computeSmaDelta(sessions, 'nao-existe')).toBe(0);
  });

  it('lista de sessões vazia retorna 0', () => {
    expect(computeSmaDelta([], 'current')).toBe(0);
  });

  it('histórico não vazio mas com média positiva nunca retorna 0 por acidente (contraste com os guardas)', () => {
    const sessions: SessionVolumePoint[] = [
      { sessionId: 'prev-1', startedAt: 100, volume: 100 },
      { sessionId: 'current', startedAt: 200, volume: 150 },
    ];
    // (150-100)/100*100 = 50, positivo — não é um dos casos de guarda.
    expect(computeSmaDelta(sessions, 'current')).toBeCloseTo(50, 6);
  });
});
