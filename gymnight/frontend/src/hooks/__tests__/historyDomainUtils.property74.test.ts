/**
 * Property-Based Test — Property 74
 *
 * partitionSessionsByWindow: janela móvel de N dias (30, fixo na tela de
 * Estatísticas) — uma sessão de exatamente N dias atrás entra na janela
 * ATUAL; uma de N+1 dias atrás já cai fora dela (na janela ANTERIOR, se
 * couber, ou fora de ambas).
 *
 * Feature: PARIDADE-03-ESTATISTICAS.md §2.2, §3.2
 */
import * as fc from 'fast-check';
import { partitionSessionsByWindow, type SessionForAggregation } from '@/hooks/historyDomainUtils';

const NOW = 1_700_000_000_000; // fixo, para o teste não depender do relógio real
const DAY_MS = 24 * 60 * 60 * 1000;
const now = () => NOW;

function sessionAt(startedAt: number, id = 's'): SessionForAggregation {
  return { id, workoutId: null, startedAt, endedAt: startedAt + 1000 };
}

describe('Property 74: partitionSessionsByWindow — janela de 30 dias', () => {
  it('sessão de exatamente 30 dias atrás entra na janela atual', () => {
    const session = sessionAt(NOW - 30 * DAY_MS);
    const { current } = partitionSessionsByWindow([session], 30, now);
    expect(current).toEqual([session]);
  });

  it('sessão de 31 dias atrás NÃO entra na janela atual', () => {
    const session = sessionAt(NOW - 31 * DAY_MS);
    const { current } = partitionSessionsByWindow([session], 30, now);
    expect(current).toEqual([]);
  });

  it('sessão de 29 dias atrás entra na janela atual', () => {
    const session = sessionAt(NOW - 29 * DAY_MS);
    const { current } = partitionSessionsByWindow([session], 30, now);
    expect(current).toEqual([session]);
  });

  it('sessão de 31 dias atrás cai na janela anterior (30-60 dias atrás)', () => {
    const session = sessionAt(NOW - 31 * DAY_MS);
    const { previous } = partitionSessionsByWindow([session], 30, now);
    expect(previous).toEqual([session]);
  });

  it('sessão de 61 dias atrás não entra em nenhuma das duas janelas', () => {
    const session = sessionAt(NOW - 61 * DAY_MS);
    const { current, previous } = partitionSessionsByWindow([session], 30, now);
    expect(current).toEqual([]);
    expect(previous).toEqual([]);
  });

  it('property: para qualquer sessão, ela cai em no máximo uma das duas janelas', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -100 * DAY_MS, max: DAY_MS }),
        (offsetFromNow) => {
          const session = sessionAt(NOW + offsetFromNow);
          const { current, previous } = partitionSessionsByWindow([session], 30, now);
          const inCurrent = current.length === 1;
          const inPrevious = previous.length === 1;
          return !(inCurrent && inPrevious);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('property: nenhuma sessão futura (depois de "agora") entra na janela atual', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 10 * DAY_MS }), (futureOffset) => {
        const session = sessionAt(NOW + futureOffset);
        const { current } = partitionSessionsByWindow([session], 30, now);
        return current.length === 0;
      }),
      { numRuns: 100 },
    );
  });
});
