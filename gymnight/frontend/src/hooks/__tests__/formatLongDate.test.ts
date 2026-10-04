/**
 * formatLongDate — data por extenso do cabeçalho do Dashboard (REDESIGN-04).
 */
import { formatLongDate } from '../historyDomainUtils';

describe('formatLongDate', () => {
  it('writes weekday, day and month in Portuguese', () => {
    expect(formatLongDate(new Date(2026, 9, 4, 10).getTime())).toBe('Domingo, 4 de outubro');
    expect(formatLongDate(new Date(2026, 9, 3, 10).getTime())).toBe('Sábado, 3 de outubro');
  });

  it('covers the month boundaries of the year', () => {
    expect(formatLongDate(new Date(2027, 0, 1, 12).getTime())).toBe('Sexta-feira, 1 de janeiro');
    expect(formatLongDate(new Date(2026, 11, 31, 12).getTime())).toBe('Quinta-feira, 31 de dezembro');
  });
});
