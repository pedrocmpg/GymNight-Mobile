/**
 * Property-Based Test — Property 88
 *
 * CARDIO_TYPES: as ~20 linhas de tipo_cardios.md viram exatamente essa
 * quantidade de tipos, cada um com nome, intensidade, faixa de PSE e
 * descrição não-vazios — e sem nomes duplicados.
 */
import { CARDIO_TYPES } from '../cardioTypes';

describe('Property 88: CARDIO_TYPES — estrutura do catálogo estático', () => {
  it('tem exatamente 20 tipos (10 máquinas + 5 peso corporal/outdoor + 5 esportes)', () => {
    expect(CARDIO_TYPES.length).toBe(20);
  });

  it('todo tipo tem nome, intensidade, faixa de PSE e descrição não-vazios', () => {
    for (const type of CARDIO_TYPES) {
      expect(type.name.trim().length).toBeGreaterThan(0);
      expect(type.intensity.trim().length).toBeGreaterThan(0);
      expect(type.pseRange.trim().length).toBeGreaterThan(0);
      expect(type.description.trim().length).toBeGreaterThan(0);
    }
  });

  it('nenhum nome de tipo se repete', () => {
    const names = CARDIO_TYPES.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('inclui tipos verbatim conhecidos do desktop, com a descrição correta', () => {
    const esteira = CARDIO_TYPES.find((t) => t.name === 'Esteira (Caminhada Plana)');
    expect(esteira).toBeDefined();
    expect(esteira?.description).toBe('Respiração normal, dá para cantar uma música.');

    const airBike = CARDIO_TYPES.find((t) => t.name === 'Air Bike (Tiros)');
    expect(airBike?.pseRange).toBe('9 - 10');
    expect(airBike?.intensity).toBe('Máxima');
  });
});
