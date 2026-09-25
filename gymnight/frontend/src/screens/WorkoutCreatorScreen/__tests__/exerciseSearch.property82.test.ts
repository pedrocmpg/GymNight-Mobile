/**
 * Property-Based Test — Property 82
 *
 * filterExercises: insensível a acento e caixa, NOS DOIS SENTIDOS — a query
 * pode vir acentuada/maiúscula ou não, e o nome do exercício também, em
 * qualquer combinação (PARIDADE-04-ROTINAS-PERFIL.md §3.3).
 */
import * as fc from 'fast-check';
import { filterExercises, normalizeForSearch, type ExerciseForSearch } from '../exerciseSearch';

describe('Property 82: filterExercises é insensível a acento e caixa nos dois sentidos', () => {
  it('buscar pela versão normalizada de um nome sempre encontra o exercício original', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({ id: fc.uuid(), name: fc.string({ minLength: 1, maxLength: 40 }) }),
          { minLength: 1, maxLength: 30 },
        ),
        fc.nat(),
        (exercises: ExerciseForSearch[], pickIndex) => {
          const target = exercises[pickIndex % exercises.length];
          const normalizedName = normalizeForSearch(target.name);
          if (normalizedName === '') return true; // nome só de diacríticos/espaço não é um caso útil

          const results = filterExercises(exercises, normalizedName);
          return results.some((e) => e.id === target.id);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('"biceps" (sem acento) encontra "Bíceps" (com acento e caixa alta)', () => {
    const exercises = [{ id: 'ex1', name: 'Bíceps' }];
    expect(filterExercises(exercises, 'biceps')).toEqual(exercises);
    expect(filterExercises(exercises, 'BICEPS')).toEqual(exercises);
    expect(filterExercises(exercises, 'BíCePs')).toEqual(exercises);
  });

  it('"supino" encontra "Supino Reto (Barra)"', () => {
    const exercises = [{ id: 'ex1', name: 'Supino Reto (Barra)' }];
    expect(filterExercises(exercises, 'supino')).toEqual(exercises);
  });

  it('query acentuada encontra nome sem acento no catálogo', () => {
    const exercises = [{ id: 'ex1', name: 'Triceps Testa' }]; // hipoteticamente sem acento no catálogo
    expect(filterExercises(exercises, 'tríceps')).toEqual(exercises);
  });

  it('trocar só a caixa da query nunca muda o conjunto de resultados', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({ id: fc.uuid(), name: fc.string({ minLength: 1, maxLength: 30 }) }),
          { minLength: 0, maxLength: 30 },
        ),
        fc.string({ minLength: 1, maxLength: 10 }),
        (exercises, query) => {
          const lower = filterExercises(exercises, query.toLowerCase());
          const upper = filterExercises(exercises, query.toUpperCase());
          const idsLower = new Set(lower.map((e) => e.id));
          const idsUpper = new Set(upper.map((e) => e.id));
          return idsLower.size === idsUpper.size && [...idsLower].every((id) => idsUpper.has(id));
        },
      ),
      { numRuns: 150 },
    );
  });
});
