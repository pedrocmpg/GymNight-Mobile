/**
 * Wave 4 — a grade de séries pré-montada e o valor "fantasma" da última sessão.
 *
 * O comportamento central: cada linha nasce com o peso/reps da MESMA série da
 * última vez que o usuário fez aquele exercício. Repetir a carga é um toque.
 */

import {
  buildSetGrid,
  countGridProgress,
  groupSetsByExercise,
  resolveGhostValue,
  validateSetEntry,
  type GridLoggedSet,
  type GridWorkoutExercise,
} from '../setGrid';

function makeExercise(
  overrides: Partial<GridWorkoutExercise> & { id: string; name: string },
): GridWorkoutExercise {
  return { seriesTarget: 3, repsTarget: 10, weightTarget: 0, ...overrides };
}

function makeSet(
  overrides: Partial<GridLoggedSet> & { id: string; exerciseId: string },
): GridLoggedSet {
  return { weight: 50, repetitions: 10, completedAt: 1000, ...overrides };
}

describe('groupSetsByExercise', () => {
  it('agrupa por exercício', () => {
    const grouped = groupSetsByExercise([
      makeSet({ id: 's1', exerciseId: 'ex1' }),
      makeSet({ id: 's2', exerciseId: 'ex2' }),
      makeSet({ id: 's3', exerciseId: 'ex1' }),
    ]);
    expect(grouped.get('ex1')).toHaveLength(2);
    expect(grouped.get('ex2')).toHaveLength(1);
  });

  it('ordena cada grupo cronologicamente', () => {
    const grouped = groupSetsByExercise([
      makeSet({ id: 's2', exerciseId: 'ex1', completedAt: 3000 }),
      makeSet({ id: 's1', exerciseId: 'ex1', completedAt: 1000 }),
    ]);
    expect(grouped.get('ex1')!.map((s) => s.id)).toEqual(['s1', 's2']);
  });

  // Duas séries no mesmo milissegundo não podem trocar de lugar entre renders,
  // senão o fantasma pula de linha na frente do usuário.
  it('desempata completedAt igual por id, de forma estável', () => {
    const grouped = groupSetsByExercise([
      makeSet({ id: 'b', exerciseId: 'ex1', completedAt: 1000 }),
      makeSet({ id: 'a', exerciseId: 'ex1', completedAt: 1000 }),
    ]);
    expect(grouped.get('ex1')!.map((s) => s.id)).toEqual(['a', 'b']);
  });

  it('devolve um Map vazio para lista vazia', () => {
    expect(groupSetsByExercise([]).size).toBe(0);
  });
});

describe('resolveGhostValue — cascata última sessão → alvo → vazio', () => {
  const exercise = makeExercise({
    id: 'ex1',
    name: 'Supino',
    repsTarget: 12,
    weightTarget: 40,
  });

  it('usa a MESMA série da última sessão', () => {
    const previous = [
      makeSet({ id: 'p1', exerciseId: 'ex1', weight: 5, repetitions: 10, completedAt: 1 }),
      makeSet({ id: 'p2', exerciseId: 'ex1', weight: 7, repetitions: 8, completedAt: 2 }),
    ];
    expect(resolveGhostValue(0, previous, exercise)).toEqual({
      weight: 5,
      reps: 10,
      source: 'ghost',
    });
    // Série 2 mostra a série 2 da última vez, não a 1.
    expect(resolveGhostValue(1, previous, exercise)).toEqual({
      weight: 7,
      reps: 8,
      source: 'ghost',
    });
  });

  it('cai no alvo do treino quando a última sessão não tem aquela série', () => {
    const previous = [makeSet({ id: 'p1', exerciseId: 'ex1', weight: 5, repetitions: 10 })];
    expect(resolveGhostValue(1, previous, exercise)).toEqual({
      weight: 40,
      reps: 12,
      source: 'ghost',
    });
  });

  it('cai no alvo quando nunca fez o exercício', () => {
    expect(resolveGhostValue(0, [], exercise)).toEqual({
      weight: 40,
      reps: 12,
      source: 'ghost',
    });
  });

  it('fica vazio quando não há histórico nem alvo', () => {
    const semAlvo = makeExercise({ id: 'ex1', name: 'Supino', repsTarget: 0, weightTarget: 0 });
    expect(resolveGhostValue(0, [], semAlvo)).toEqual({
      weight: null,
      reps: null,
      source: 'empty',
    });
  });

  it('omite só o campo de alvo zerado, mantendo o outro', () => {
    const soReps = makeExercise({ id: 'ex1', name: 'Barra', repsTarget: 10, weightTarget: 0 });
    expect(resolveGhostValue(0, [], soReps)).toEqual({
      weight: null,
      reps: 10,
      source: 'ghost',
    });
  });
});

describe('buildSetGrid', () => {
  const exercises = [
    makeExercise({ id: 'ex1', name: 'Supino', seriesTarget: 3, repsTarget: 10, weightTarget: 40 }),
    makeExercise({ id: 'ex2', name: 'Agachamento', seriesTarget: 2, repsTarget: 8, weightTarget: 60 }),
  ];

  it('cria uma linha por seriesTarget', () => {
    const grid = buildSetGrid(exercises, [], []);
    expect(grid[0].rows).toHaveLength(3);
    expect(grid[1].rows).toHaveLength(2);
  });

  it('numera as séries a partir de 1', () => {
    const grid = buildSetGrid(exercises, [], []);
    expect(grid[0].rows.map((r) => r.setNumber)).toEqual([1, 2, 3]);
  });

  it('preserva a ordem dos exercícios do treino', () => {
    const grid = buildSetGrid(exercises, [], []);
    expect(grid.map((g) => g.exerciseId)).toEqual(['ex1', 'ex2']);
  });

  // O cenário que o usuário descreveu: 5kg × 10 na semana passada aparece
  // apagado hoje, pronto para ser confirmado com um toque.
  it('preenche as linhas com o fantasma da última sessão', () => {
    const previous = [
      makeSet({ id: 'p1', exerciseId: 'ex1', weight: 5, repetitions: 10, completedAt: 1 }),
    ];
    const grid = buildSetGrid(exercises, [], previous);
    expect(grid[0].rows[0]).toMatchObject({
      weight: 5,
      reps: 10,
      source: 'ghost',
      isLogged: false,
    });
  });

  it('marca como logged as séries já gravadas nesta sessão', () => {
    const current = [
      makeSet({ id: 'c1', exerciseId: 'ex1', weight: 80, repetitions: 6, completedAt: 100 }),
    ];
    const grid = buildSetGrid(exercises, current, []);
    expect(grid[0].rows[0]).toMatchObject({
      weight: 80,
      reps: 6,
      source: 'logged',
      isLogged: true,
      loggedSetId: 'c1',
    });
    // A série seguinte continua fantasma.
    expect(grid[0].rows[1].isLogged).toBe(false);
  });

  it('a série gravada hoje tem precedência sobre o fantasma', () => {
    const current = [makeSet({ id: 'c1', exerciseId: 'ex1', weight: 80, repetitions: 6 })];
    const previous = [makeSet({ id: 'p1', exerciseId: 'ex1', weight: 5, repetitions: 10 })];
    const grid = buildSetGrid(exercises, current, previous);
    expect(grid[0].rows[0].weight).toBe(80);
  });

  it('conta as séries concluídas por exercício', () => {
    const current = [
      makeSet({ id: 'c1', exerciseId: 'ex1', completedAt: 1 }),
      makeSet({ id: 'c2', exerciseId: 'ex1', completedAt: 2 }),
    ];
    const grid = buildSetGrid(exercises, current, []);
    expect(grid[0].completedCount).toBe(2);
    expect(grid[0].totalCount).toBe(3);
  });

  // Sem o max(), registrar uma 4ª série num treino de 3 faria ela sumir da tela.
  it('não esconde séries gravadas além do alvo', () => {
    const current = [
      makeSet({ id: 'c1', exerciseId: 'ex1', completedAt: 1 }),
      makeSet({ id: 'c2', exerciseId: 'ex1', completedAt: 2 }),
      makeSet({ id: 'c3', exerciseId: 'ex1', completedAt: 3 }),
      makeSet({ id: 'c4', exerciseId: 'ex1', completedAt: 4 }),
    ];
    const grid = buildSetGrid(exercises, current, []);
    expect(grid[0].rows).toHaveLength(4);
    expect(grid[0].rows[3].isLogged).toBe(true);
  });

  it('ignora séries de exercícios que não estão no treino', () => {
    const current = [makeSet({ id: 'c1', exerciseId: 'ex-fora' })];
    const grid = buildSetGrid(exercises, current, []);
    expect(grid).toHaveLength(2);
    expect(grid[0].completedCount).toBe(0);
  });

  it('devolve grade vazia quando o treino não tem exercícios', () => {
    expect(buildSetGrid([], [], [])).toEqual([]);
  });

  it('trata seriesTarget zero ou negativo sem quebrar', () => {
    const zerado = [makeExercise({ id: 'ex1', name: 'X', seriesTarget: 0 })];
    expect(buildSetGrid(zerado, [], [])[0].rows).toHaveLength(0);
    const negativo = [makeExercise({ id: 'ex1', name: 'X', seriesTarget: -2 })];
    expect(buildSetGrid(negativo, [], [])[0].rows).toHaveLength(0);
  });
});

describe('countGridProgress', () => {
  it('soma a grade inteira', () => {
    const exercises = [
      makeExercise({ id: 'ex1', name: 'A', seriesTarget: 3 }),
      makeExercise({ id: 'ex2', name: 'B', seriesTarget: 2 }),
    ];
    const current = [
      makeSet({ id: 'c1', exerciseId: 'ex1', completedAt: 1 }),
      makeSet({ id: 'c2', exerciseId: 'ex2', completedAt: 2 }),
    ];
    expect(countGridProgress(buildSetGrid(exercises, current, []))).toEqual({
      completed: 2,
      total: 5,
      ratio: 2 / 5,
    });
  });

  it('não divide por zero numa grade vazia', () => {
    expect(countGridProgress([])).toEqual({ completed: 0, total: 0, ratio: 0 });
  });
});

describe('validateSetEntry — port de active_workout.py:665', () => {
  it('aceita peso e reps válidos', () => {
    expect(validateSetEntry('80', '10')).toMatchObject({
      valid: true,
      weight: 80,
      reps: 10,
    });
  });

  it('rejeita campos vazios apontando qual falhou', () => {
    expect(validateSetEntry('', '10')).toMatchObject({
      valid: false,
      weightError: true,
      repsError: false,
    });
    expect(validateSetEntry('80', '')).toMatchObject({
      valid: false,
      weightError: false,
      repsError: true,
    });
  });

  it('rejeita null (campo nunca preenchido nem fantasma)', () => {
    expect(validateSetEntry(null, null).valid).toBe(false);
  });

  it('rejeita texto não numérico', () => {
    expect(validateSetEntry('abc', '10').weightError).toBe(true);
    expect(validateSetEntry('80', 'abc').repsError).toBe(true);
  });

  it('aceita peso zero — exercício de peso corporal', () => {
    expect(validateSetEntry('0', '12')).toMatchObject({ valid: true, weight: 0 });
  });

  it('rejeita peso negativo e reps abaixo de 1', () => {
    expect(validateSetEntry('-5', '10').weightError).toBe(true);
    expect(validateSetEntry('80', '0').repsError).toBe(true);
  });

  it('aceita vírgula decimal', () => {
    expect(validateSetEntry('7,5', '10')).toMatchObject({ valid: true, weight: 7.5 });
  });

  it('trunca reps fracionadas', () => {
    expect(validateSetEntry('80', '10.7').reps).toBe(10);
  });

  it('ignora espaços em volta', () => {
    expect(validateSetEntry('  80  ', ' 10 ').valid).toBe(true);
    expect(validateSetEntry('   ', '10').weightError).toBe(true);
  });
});
