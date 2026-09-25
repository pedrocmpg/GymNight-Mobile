/**
 * Property-Based Test — Property 80
 *
 * toggleGoalFifo: tocar num objetivo JÁ selecionado desmarca — nunca aciona
 * a evicção FIFO (o toque é uma remoção simples, não uma "terceira seleção").
 */
import * as fc from 'fast-check';
import { toggleGoalFifo, GOAL_OPTIONS, serializeGoals, parseGoals } from '../onboardingDomain';

const arbGoalId = fc.constantFrom(...GOAL_OPTIONS.map((g) => g.id));

describe('Property 80: tocar num objetivo já selecionado desmarca', () => {
  it('tocar num objetivo JÁ selecionado sempre o remove, e só ele (nunca aciona FIFO)', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(arbGoalId, { minLength: 1, maxLength: 2 }),
        fc.nat(),
        (initiallySelected, pickIndex) => {
          const goalId = initiallySelected[pickIndex % initiallySelected.length];
          const result = toggleGoalFifo(initiallySelected, goalId);

          // O objetivo tocado sai; todo o resto do array permanece intacto.
          const expected = initiallySelected.filter((g) => g !== goalId);
          return JSON.stringify(result) === JSON.stringify(expected);
        },
      ),
      { numRuns: 150 },
    );
  });

  it('tocar duas vezes seguidas num objetivo AINDA NÃO selecionado (com espaço livre) volta ao estado original', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(arbGoalId, { minLength: 0, maxLength: 1 }),
        arbGoalId,
        (initiallySelected, goalId) => {
          fc.pre(!initiallySelected.includes(goalId)); // com espaço livre, não há evicção a confundir

          const afterFirstTap = toggleGoalFifo(initiallySelected, goalId);
          const afterSecondTap = toggleGoalFifo(afterFirstTap, goalId);

          return JSON.stringify(afterSecondTap) === JSON.stringify(initiallySelected);
        },
      ),
      { numRuns: 150 },
    );
  });

  it('com 2 já selecionados, desmarcar um deles NUNCA evicta o outro (só reduz para 1)', () => {
    let selected = ['Hipertrofia', 'Saúde'];
    selected = toggleGoalFifo(selected, 'Hipertrofia');
    expect(selected).toEqual(['Saúde']);
  });

  it('desmarcar o único selecionado esvazia a lista', () => {
    let selected = ['Hipertrofia'];
    selected = toggleGoalFifo(selected, 'Hipertrofia');
    expect(selected).toEqual([]);
  });

  it('serializeGoals/parseGoals são inversos um do outro, para 0, 1 ou 2 objetivos', () => {
    fc.assert(
      fc.property(fc.array(arbGoalId, { minLength: 0, maxLength: 2 }), (taps) => {
        let selected: string[] = [];
        for (const id of taps) selected = toggleGoalFifo(selected, id);
        const roundTripped = parseGoals(serializeGoals(selected));
        return JSON.stringify(roundTripped) === JSON.stringify(selected);
      }),
      { numRuns: 100 },
    );
  });

  it('parseGoals de string vazia ou null devolve array vazio', () => {
    expect(parseGoals('')).toEqual([]);
    expect(parseGoals(null)).toEqual([]);
  });
});
