/**
 * Property-Based Test — Property 83
 *
 * filterExercises: query vazia (ou só espaços) devolve o catálogo inteiro,
 * inalterado; sem nenhum match devolve array vazio.
 */
import * as fc from 'fast-check';
import { filterExercises, normalizeForSearch, type ExerciseForSearch } from '../exerciseSearch';

const arbExercise: fc.Arbitrary<ExerciseForSearch> = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 40 }),
});

describe('Property 83: filterExercises — query vazia devolve tudo; sem match devolve vazio', () => {
  it('query vazia devolve exatamente o catálogo de entrada (mesmos itens, mesma ordem)', () => {
    fc.assert(
      fc.property(fc.array(arbExercise, { maxLength: 30 }), (exercises) => {
        return filterExercises(exercises, '') === exercises || filterExercises(exercises, '').every(
          (e, i) => e === exercises[i],
        );
      }),
      { numRuns: 100 },
    );
  });

  it('query só de espaços também devolve o catálogo inteiro', () => {
    fc.assert(
      fc.property(
        fc.array(arbExercise, { maxLength: 30 }),
        fc.string({ minLength: 1, maxLength: 5 }).map((s) => ' '.repeat(s.length)),
        (exercises, spaces) => {
          const result = filterExercises(exercises, spaces);
          return result.length === exercises.length;
        },
      ),
      { numRuns: 100 },
    );
  });

  it('catálogo vazio sempre devolve vazio, com ou sem query', () => {
    expect(filterExercises([], '')).toEqual([]);
    expect(filterExercises([], 'supino')).toEqual([]);
  });

  it('query que não bate com nenhum nome devolve array vazio', () => {
    const exercises = [
      { id: 'ex1', name: 'Supino Reto (Barra)' },
      { id: 'ex2', name: 'Agachamento Livre' },
    ];
    expect(filterExercises(exercises, 'xyzxyzxyz-nao-existe')).toEqual([]);
  });

  it('property (solidez): todo item devolvido realmente contém a query normalizada no nome normalizado', () => {
    fc.assert(
      fc.property(
        fc.array(arbExercise, { maxLength: 20 }),
        fc.string({ minLength: 1, maxLength: 8 }).filter((q) => q.trim() !== ''),
        (exercises, query) => {
          const normalizedQuery = normalizeForSearch(query);
          const result = filterExercises(exercises, query);
          return result.every((e) => normalizeForSearch(e.name).includes(normalizedQuery));
        },
      ),
      { numRuns: 150 },
    );
  });

  it('property (completude): todo item cujo nome normalizado contém a query normalizada aparece no resultado', () => {
    fc.assert(
      fc.property(
        fc.array(arbExercise, { maxLength: 20 }),
        fc.string({ minLength: 1, maxLength: 8 }).filter((q) => q.trim() !== ''),
        (exercises, query) => {
          const normalizedQuery = normalizeForSearch(query);
          const result = filterExercises(exercises, query);
          const resultIds = new Set(result.map((e) => e.id));
          return exercises
            .filter((e) => normalizeForSearch(e.name).includes(normalizedQuery))
            .every((e) => resultIds.has(e.id));
        },
      ),
      { numRuns: 150 },
    );
  });
});
