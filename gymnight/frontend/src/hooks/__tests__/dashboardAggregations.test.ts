/**
 * Wave 3 — agregações do Dashboard portadas de dashboard.py.
 *
 * Todas as funções sob teste são puras e aceitam `now` injetável, então os
 * testes são determinísticos sem precisar de fake timers.
 */
import {
  reorderWeekMondayFirst,
  countTrainingDaysThisWeek,
  formatVolume,
  computeWeekStreak,
  formatRelativeDay,
  type SessionForAggregation,
} from '../historyDomainUtils';

const DAY = 24 * 60 * 60 * 1000;
const WEEK = 7 * DAY;

/** Quarta-feira, 2026-08-26, 12:00 local. */
const NOW = new Date(2026, 7, 26, 12, 0, 0).getTime();
const now = () => NOW;

function session(startedAt: number, ended = true): SessionForAggregation {
  return {
    id: `s-${startedAt}`,
    workoutId: 'w1',
    startedAt,
    endedAt: ended ? startedAt + 3600_000 : null,
  };
}

describe('reorderWeekMondayFirst', () => {
  it('move domingo do início para o fim', () => {
    expect(reorderWeekMondayFirst(['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'])).toEqual([
      'seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom',
    ]);
  });

  it('preserva o tamanho e não muta a entrada', () => {
    const input = [true, false, false, false, false, false, false];
    const output = reorderWeekMondayFirst(input);
    expect(output).toHaveLength(7);
    expect(input).toEqual([true, false, false, false, false, false, false]);
    // domingo (índice 0) vai para o fim
    expect(output[6]).toBe(true);
  });
});

describe('countTrainingDaysThisWeek', () => {
  it('conta 0 sem sessões', () => {
    expect(countTrainingDaysThisWeek([], now)).toBe(0);
  });

  it('conta dias distintos, não sessões', () => {
    const sessions = [session(NOW - DAY), session(NOW - DAY + 3 * 3600_000), session(NOW - 2 * DAY)];
    expect(countTrainingDaysThisWeek(sessions, now)).toBe(2);
  });

  it('ignora sessões em andamento', () => {
    expect(countTrainingDaysThisWeek([session(NOW - DAY, false)], now)).toBe(0);
  });

  it('ignora sessões fora da janela de 7 dias', () => {
    expect(countTrainingDaysThisWeek([session(NOW - 10 * DAY)], now)).toBe(0);
  });

  it('nunca passa de 7', () => {
    const sessions = Array.from({ length: 20 }, (_, i) => session(NOW - i * 6 * 3600_000));
    expect(countTrainingDaysThisWeek(sessions, now)).toBeLessThanOrEqual(7);
  });
});

describe('formatVolume', () => {
  it.each([
    [0, '0'],
    [1, '1'],
    [999, '999'],
    [999.4, '999'],
    [1000, '1.0k'],
    [12400, '12.4k'],
    [1234567, '1234.6k'],
  ])('formata %p como %p', (input, expected) => {
    expect(formatVolume(input)).toBe(expected);
  });
});

describe('computeWeekStreak', () => {
  it('é 0 sem sessões', () => {
    expect(computeWeekStreak([], now)).toBe(0);
  });

  it('conta 1 quando só treinou na semana atual', () => {
    expect(computeWeekStreak([session(NOW - DAY)], now)).toBe(1);
  });

  it('conta semanas consecutivas para trás', () => {
    const sessions = [session(NOW), session(NOW - WEEK), session(NOW - 2 * WEEK)];
    expect(computeWeekStreak(sessions, now)).toBe(3);
  });

  it('para na primeira semana sem treino', () => {
    const sessions = [session(NOW), session(NOW - WEEK), session(NOW - 3 * WEEK)];
    expect(computeWeekStreak(sessions, now)).toBe(2);
  });

  it('mantém o streak vivo se treinou na semana passada mas ainda não nesta', () => {
    const sessions = [session(NOW - WEEK), session(NOW - 2 * WEEK)];
    expect(computeWeekStreak(sessions, now)).toBe(2);
  });

  it('zera se o treino mais recente é anterior à semana passada', () => {
    expect(computeWeekStreak([session(NOW - 3 * WEEK)], now)).toBe(0);
  });

  it('ignora sessões em andamento', () => {
    expect(computeWeekStreak([session(NOW, false)], now)).toBe(0);
  });
});

describe('formatRelativeDay', () => {
  it('rotula o mesmo dia de calendário como Hoje', () => {
    expect(formatRelativeDay(NOW, now)).toBe('Hoje');
    expect(formatRelativeDay(new Date(2026, 7, 26, 1, 0, 0).getTime(), now)).toBe('Hoje');
  });

  it('rotula o dia anterior como Ontem, mesmo com menos de 24h de diferença', () => {
    // 23h de 25/08 → 13h antes de NOW, mas é o dia de calendário anterior.
    expect(formatRelativeDay(new Date(2026, 7, 25, 23, 0, 0).getTime(), now)).toBe('Ontem');
  });

  it('usa "há N dias" a partir de 2 dias', () => {
    expect(formatRelativeDay(NOW - 2 * DAY, now)).toBe('há 2 dias');
    expect(formatRelativeDay(NOW - 30 * DAY, now)).toBe('há 30 dias');
  });

  it('trata timestamps futuros como Hoje em vez de gerar negativo', () => {
    expect(formatRelativeDay(NOW + 5 * DAY, now)).toBe('Hoje');
  });
});
