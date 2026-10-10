import {
  equipmentLabel,
  exerciseName,
  exerciseSubtitle,
  muscleGroupLabel,
} from '../exerciseLabels';

const BENCH = { name: 'Supino reto com barra', nameEn: 'Barbell Bench Press' };

describe('exerciseName', () => {
  it('uses the PT name in PT', () => {
    expect(exerciseName(BENCH, 'pt')).toBe('Supino reto com barra');
  });

  it('uses the EN name in EN', () => {
    expect(exerciseName(BENCH, 'en')).toBe('Barbell Bench Press');
  });

  it('falls back to PT when there is no EN name yet', () => {
    expect(exerciseName({ name: 'Supino' }, 'en')).toBe('Supino');
    expect(exerciseName({ name: 'Supino', nameEn: null }, 'en')).toBe('Supino');
    expect(exerciseName({ name: 'Supino', nameEn: '' }, 'en')).toBe('Supino');
  });
});

describe('muscleGroupLabel / equipmentLabel', () => {
  it('translates all 7 muscle groups to EN', () => {
    const groups = ['Peito', 'Costas', 'Ombros', 'Bíceps', 'Tríceps', 'Pernas', 'Abdômen'];
    const translated = groups.map((g) => muscleGroupLabel(g, 'en'));
    expect(translated).toEqual(['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Legs', 'Abs']);
  });

  it('keeps PT labels in PT', () => {
    expect(muscleGroupLabel('Peito', 'pt')).toBe('Peito');
    expect(equipmentLabel('Halter', 'pt')).toBe('Halter');
  });

  it('translates every equipment value the catalog uses', () => {
    const equipment = [
      'Barra',
      'Barra EZ',
      'Barra hexagonal',
      'Halter',
      'Polia',
      'Máquina',
      'Máquina (trenó)',
      'Smith',
      'Peso corporal',
      'Elástico',
      'Com carga',
      'Roda abdominal',
    ];
    for (const value of equipment) {
      expect(equipmentLabel(value, 'en')).not.toBe(value);
    }
    expect(equipmentLabel('Kettlebell', 'en')).toBe('Kettlebell');
  });

  it('falls back to the stored value for unknown labels', () => {
    expect(equipmentLabel('Trampolim', 'en')).toBe('Trampolim');
    expect(muscleGroupLabel('Glúteos', 'en')).toBe('Glúteos');
  });
});

describe('exerciseSubtitle', () => {
  it('joins the primary group and the equipment', () => {
    expect(exerciseSubtitle({ primaryGroup: 'Peito', equipment: 'Barra' }, 'pt')).toBe('Peito · Barra');
    expect(exerciseSubtitle({ primaryGroup: 'Peito', equipment: 'Barra' }, 'en')).toBe('Chest · Barbell');
  });

  it('omits missing parts and returns undefined when there is nothing', () => {
    expect(exerciseSubtitle({ primaryGroup: 'Peito' }, 'pt')).toBe('Peito');
    expect(exerciseSubtitle({ equipment: 'Halter' }, 'pt')).toBe('Halter');
    expect(exerciseSubtitle({}, 'pt')).toBeUndefined();
  });
});
