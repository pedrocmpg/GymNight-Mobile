/**
 * Property-Based Test — Property 87
 *
 * Validação de cardio: duração > 0; PSE inteiro em 1-10; distância é sempre
 * opcional (ausência sempre válida) e, quando informada, >= 0.
 */
import * as fc from 'fast-check';
import { isValidCardioDuration, isValidPse, isValidCardioDistance } from '../cardioDomain';

describe('Property 87: validação de cardio', () => {
  it('duração > 0 é sempre válida; <= 0 é sempre inválida', () => {
    fc.assert(
      fc.property(fc.float({ min: Math.fround(0.001), max: Math.fround(1000), noNaN: true }), (d) =>
        isValidCardioDuration(d),
      ),
      { numRuns: 100 },
    );
    expect(isValidCardioDuration(0)).toBe(false);
    expect(isValidCardioDuration(-5)).toBe(false);
    expect(isValidCardioDuration(NaN)).toBe(false);
    expect(isValidCardioDuration(Infinity)).toBe(false);
  });

  it('PSE inteiro de 1 a 10 é sempre válido', () => {
    for (let pse = 1; pse <= 10; pse++) {
      expect(isValidPse(pse)).toBe(true);
    }
  });

  it('PSE fora de 1-10, ou não-inteiro, é sempre inválido', () => {
    expect(isValidPse(0)).toBe(false);
    expect(isValidPse(11)).toBe(false);
    expect(isValidPse(5.5)).toBe(false);
    expect(isValidPse(-1)).toBe(false);
    fc.assert(
      fc.property(
        fc.oneof(
          fc.integer({ min: -100, max: 0 }),
          fc.integer({ min: 11, max: 100 }),
        ),
        (pse) => !isValidPse(pse),
      ),
      { numRuns: 100 },
    );
  });

  it('distância ausente (null) é SEMPRE válida — o campo é opcional', () => {
    expect(isValidCardioDistance(null)).toBe(true);
  });

  it('distância informada precisa ser >= 0', () => {
    fc.assert(
      fc.property(fc.float({ min: 0, max: 1000, noNaN: true }), (dist) => isValidCardioDistance(dist)),
      { numRuns: 100 },
    );
    expect(isValidCardioDistance(-1)).toBe(false);
    expect(isValidCardioDistance(NaN)).toBe(false);
  });
});
