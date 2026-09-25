/**
 * Property-Based Test — Property 81
 *
 * Validação do onboarding: peso 30–300, altura 100–250 (inclusive); fora
 * dessa faixa não avança (setup.py).
 */
import * as fc from 'fast-check';
import { isValidWeight, isValidHeight, isValidName } from '../onboardingDomain';

describe('Property 81: validação do onboarding — peso 30-300, altura 100-250', () => {
  it('peso dentro de [30, 300] é sempre válido', () => {
    fc.assert(
      fc.property(fc.float({ min: 30, max: 300, noNaN: true }), (weight) => isValidWeight(weight)),
      { numRuns: 200 },
    );
  });

  it('peso abaixo de 30 ou acima de 300 é sempre inválido', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.float({ min: Math.fround(-1000), max: Math.fround(29.999), noNaN: true }),
          fc.float({ min: Math.fround(300.001), max: Math.fround(2000), noNaN: true }),
        ),
        (weight) => !isValidWeight(weight),
      ),
      { numRuns: 200 },
    );
  });

  it('altura dentro de [100, 250] é sempre válida', () => {
    fc.assert(
      fc.property(fc.float({ min: 100, max: 250, noNaN: true }), (height) => isValidHeight(height)),
      { numRuns: 200 },
    );
  });

  it('altura abaixo de 100 ou acima de 250 é sempre inválida', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.float({ min: Math.fround(-1000), max: Math.fround(99.999), noNaN: true }),
          fc.float({ min: Math.fround(250.001), max: Math.fround(2000), noNaN: true }),
        ),
        (height) => !isValidHeight(height),
      ),
      { numRuns: 200 },
    );
  });

  it('os limites exatos (30, 300, 100, 250) são válidos (inclusivos)', () => {
    expect(isValidWeight(30)).toBe(true);
    expect(isValidWeight(300)).toBe(true);
    expect(isValidHeight(100)).toBe(true);
    expect(isValidHeight(250)).toBe(true);
  });

  it('NaN/Infinity nunca são válidos, para peso ou altura', () => {
    expect(isValidWeight(NaN)).toBe(false);
    expect(isValidWeight(Infinity)).toBe(false);
    expect(isValidWeight(-Infinity)).toBe(false);
    expect(isValidHeight(NaN)).toBe(false);
    expect(isValidHeight(Infinity)).toBe(false);
  });

  it('nome vazio ou só espaço é inválido; qualquer outro texto é válido', () => {
    expect(isValidName('')).toBe(false);
    expect(isValidName('   ')).toBe(false);
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0),
        (name) => isValidName(name),
      ),
      { numRuns: 100 },
    );
  });
});
