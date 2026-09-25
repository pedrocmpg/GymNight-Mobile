/**
 * Property-Based Test — Property 75
 *
 * computeSmaDelta: a sessão ATUAL é estruturalmente excluída da própria
 * média — o desktop marca essa exclusão como correção de um bug (incluí-la
 * diluiria o sinal de sobrecarga). Aqui a exclusão é por `sessionId`, não uma
 * convenção do chamador: nenhuma entrada com o `currentSessionId` pode
 * influenciar o resultado.
 *
 * Feature: PARIDADE-03-ESTATISTICAS.md §4.1
 */
import * as fc from 'fast-check';
import { computeSmaDelta, type SessionVolumePoint } from '@/hooks/historyDomainUtils';

// Volume mínimo 1 (nunca perto de 0): o que a property verifica é a EXCLUSÃO
// estrutural da sessão atual, não estabilidade numérica de divisão por uma
// média quase-zero (isso não é o que property 75 se propõe a provar — um
// denominador na casa de 1e-14 amplifica ruído de ponto flutuante e não tem
// relação com o bug que esta property existe pra pegar).
const arbHistoryEntry = fc.record({
  startedAt: fc.integer({ min: 1, max: 1000 }),
  volume: fc.float({ min: Math.fround(1), max: Math.fround(10000), noNaN: true }),
});

const arbHistory = fc
  .array(arbHistoryEntry, { minLength: 1, maxLength: 5 })
  .map((entries) => entries.map((e, i) => ({ sessionId: `prev-${i}`, ...e })));

describe('Property 75: computeSmaDelta exclui a sessão atual da própria média', () => {
  it('mudar o volume da sessão atual nunca muda a média histórica usada (e portanto muda só o delta pela diferença esperada)', () => {
    fc.assert(
      fc.property(
        arbHistory.chain((history) =>
          fc.tuple(
            fc.constant(history),
            fc.float({ min: 0, max: Math.fround(10000), noNaN: true }),
            fc.float({ min: 0, max: Math.fround(10000), noNaN: true }),
          ),
        ),
        ([history, volumeA, volumeB]) => {
          // "current" sempre começa DEPOIS de toda a história (startedAt maior).
          const currentStartedAt = 10000;
          const sessions = (currentVolume: number): SessionVolumePoint[] => [
            ...history,
            { sessionId: 'current', startedAt: currentStartedAt, volume: currentVolume },
          ];

          const deltaA = computeSmaDelta(sessions(volumeA), 'current');
          const deltaB = computeSmaDelta(sessions(volumeB), 'current');

          const historicalAvg =
            history.reduce((sum, s) => sum + s.volume, 0) / history.length;
          const expectedDiff = ((volumeA - volumeB) / historicalAvg) * 100;
          const tolerance = Math.abs(expectedDiff) * 1e-6 + 1e-6;
          return Math.abs(deltaA - deltaB - expectedDiff) <= tolerance;
        },
      ),
      { numRuns: 150 },
    );
  });

  it('duplicar a sessão atual dentro do próprio histórico (mesmo sessionId, volume diferente) não faz a duplicata contar', () => {
    const sessions: SessionVolumePoint[] = [
      { sessionId: 'prev-1', startedAt: 100, volume: 200 },
      { sessionId: 'prev-2', startedAt: 200, volume: 200 },
      // "current" aparece duas vezes por acidente de dados — nenhuma cópia pode contar na média.
      { sessionId: 'current', startedAt: 300, volume: 9999 },
      { sessionId: 'current', startedAt: 300, volume: 9999 },
    ];
    // Média esperada: (200+200)/2 = 200. current = 9999 -> delta = (9999-200)/200*100.
    const expected = ((9999 - 200) / 200) * 100;
    expect(computeSmaDelta(sessions, 'current')).toBeCloseTo(expected, 6);
  });

  it('sessões futuras (depois da atual) nunca entram na média histórica', () => {
    const sessions: SessionVolumePoint[] = [
      { sessionId: 'current', startedAt: 100, volume: 500 },
      { sessionId: 'future', startedAt: 200, volume: 1_000_000 }, // depois da atual
    ];
    // Sem histórico ANTERIOR válido -> guard de histórico vazio -> 0.
    expect(computeSmaDelta(sessions, 'current')).toBe(0);
  });

  it('só as N sessões anteriores mais recentes entram na janela do SMA', () => {
    const history: SessionVolumePoint[] = Array.from({ length: 10 }, (_, i) => ({
      sessionId: `prev-${i}`,
      startedAt: i, // 0..9, crescente
      volume: i, // 0..9
    }));
    const sessions: SessionVolumePoint[] = [
      ...history,
      { sessionId: 'current', startedAt: 100, volume: 0 },
    ];
    // As 5 mais recentes (n default) são startedAt 5,6,7,8,9 -> volumes 5,6,7,8,9 -> média 7.
    const delta = computeSmaDelta(sessions, 'current', 5);
    const expected = ((0 - 7) / 7) * 100;
    expect(delta).toBeCloseTo(expected, 6);
  });
});
