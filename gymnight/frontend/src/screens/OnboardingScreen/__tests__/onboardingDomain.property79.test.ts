/**
 * Property-Based Test — Property 79
 *
 * toggleGoalFifo: nunca passa de 2 objetivos selecionados; o terceiro
 * evicta o MAIS ANTIGO (índice 0), nunca o mais novo — setup.py:663.
 */
import * as fc from 'fast-check';
import { toggleGoalFifo, GOAL_OPTIONS } from '../onboardingDomain';

const arbGoalId = fc.constantFrom(...GOAL_OPTIONS.map((g) => g.id));

describe('Property 79: toggleGoalFifo nunca passa de 2, evicta o mais antigo', () => {
  it('nunca resulta em mais de 2 selecionados, para qualquer sequência de toques', () => {
    fc.assert(
      fc.property(fc.array(arbGoalId, { minLength: 0, maxLength: 20 }), (taps) => {
        let selected: string[] = [];
        for (const goalId of taps) {
          selected = toggleGoalFifo(selected, goalId);
          if (selected.length > 2) return false;
        }
        return true;
      }),
      { numRuns: 200 },
    );
  });

  it('adicionar um terceiro objetivo distinto evicta o primeiro (mais antigo), preserva o segundo, adiciona o terceiro', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(arbGoalId, { minLength: 3, maxLength: 3 }),
        ([first, second, third]) => {
          let selected: string[] = [];
          selected = toggleGoalFifo(selected, first);
          selected = toggleGoalFifo(selected, second);
          selected = toggleGoalFifo(selected, third);
          return (
            selected.length === 2 &&
            !selected.includes(first) &&
            selected.includes(second) &&
            selected.includes(third)
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  it('caso concreto: Hipertrofia, Saúde, depois Resistência -> Hipertrofia sai, Saúde e Resistência ficam', () => {
    let selected: string[] = [];
    selected = toggleGoalFifo(selected, 'Hipertrofia');
    selected = toggleGoalFifo(selected, 'Saúde');
    expect(selected).toEqual(['Hipertrofia', 'Saúde']);

    selected = toggleGoalFifo(selected, 'Resistência');
    expect(selected).toEqual(['Saúde', 'Resistência']);
  });

  it('a evicção do quarto toque remove o então-mais-antigo (Saúde), não Resistência', () => {
    let selected = ['Saúde', 'Resistência'];
    selected = toggleGoalFifo(selected, 'Emagrecimento');
    expect(selected).toEqual(['Resistência', 'Emagrecimento']);
  });
});
