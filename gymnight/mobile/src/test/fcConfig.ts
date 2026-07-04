/**
 * Configuração global do fast-check para o projeto GymNight.
 *
 * Garante que todos os testes de propriedade executem no mínimo 100 iterações
 * (numRuns). Para testes específicos que precisam de mais iterações, basta
 * passar um valor maior — este módulo impõe apenas o piso.
 *
 * Uso:
 *   import { fcAssert, fcProperty } from '@/test/fcConfig';
 *   fcAssert(fcProperty(fc.integer(), (n) => n === n));
 */
import fc, { type Parameters } from 'fast-check';

const MIN_NUM_RUNS = 100;

/**
 * Wrapper over fc.assert that enforces a minimum numRuns.
 * Any user-specified numRuns below the minimum is overridden.
 */
export function fcAssert<Ts>(
  property: fc.IAsyncProperty<Ts> | fc.IProperty<Ts>,
  params?: Parameters<Ts>,
): Promise<void> | void {
  const effectiveNumRuns = Math.max(
    MIN_NUM_RUNS,
    params?.numRuns ?? MIN_NUM_RUNS,
  );
  return fc.assert(property, { ...params, numRuns: effectiveNumRuns });
}

/**
 * Re-export of fc.property for convenience.
 * Use alongside fcAssert for a clean DX.
 */
export const fcProperty = fc.property;

/**
 * Re-export of fc.asyncProperty for async property tests.
 */
export const fcAsyncProperty = fc.asyncProperty;

/**
 * Re-export fc itself for access to arbitraries (fc.integer(), fc.string(), etc.)
 */
export { fc };
