/**
 * Property-Based Test — Property 49
 *
 * computeWeeklyStreak marks exactly the days of the current week (Sunday..Saturday,
 * local time) that have at least one FINISHED session (endedAt != null) started on
 * that day. Unfinished sessions and sessions outside the current week never mark a
 * day as trained.
 *
 * Feature: dashboard-history-progress
 */
import * as fc from 'fast-check';
import { computeWeeklyStreak, SessionForAggregation } from '@/hooks/historyDomainUtils';

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfWeek(timestampMs: number): Date {
  const d = new Date(timestampMs);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

// Fixed reference "now": Wednesday 2026-08-19T12:00:00 local time.
const FIXED_NOW = new Date(2026, 7, 19, 12, 0, 0).getTime();
const fixedNow = () => FIXED_NOW;

describe('Property 49: computeWeeklyStreak', () => {
  it('marks true only for days in the current week with >=1 finished session', () => {
    const weekStartMs = startOfWeek(FIXED_NOW).getTime();

    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.uuid(),
            workoutId: fc.option(fc.uuid(), { nil: null }),
            dayOffset: fc.integer({ min: 0, max: 6 }),
            hourOffset: fc.integer({ min: 0, max: 23 }),
            finished: fc.boolean(),
          }),
          { maxLength: 30 },
        ),
        (specs) => {
          const sessions: SessionForAggregation[] = specs.map((s, i) => {
            const startedAt = weekStartMs + s.dayOffset * DAY_MS + s.hourOffset * 60 * 60 * 1000;
            return {
              id: s.id + i,
              workoutId: s.workoutId,
              startedAt,
              endedAt: s.finished ? startedAt + 1000 : null,
            };
          });

          const result = computeWeeklyStreak(sessions, fixedNow);

          const expected = new Array(7).fill(false);
          for (const s of sessions) {
            if (s.endedAt === null) continue;
            const dayIndex = new Date(s.startedAt).getDay();
            expected[dayIndex] = true;
          }

          return (
            result.length === 7 && result.every((v, idx) => v === expected[idx])
          );
        },
      ),
      { numRuns: 200 },
    );
  });

  it('unfinished sessions never mark a day as trained', () => {
    const weekStartMs = startOfWeek(FIXED_NOW).getTime();
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 6 }), fc.integer({ min: 0, max: 23 }), (dayOffset, hourOffset) => {
        const startedAt = weekStartMs + dayOffset * DAY_MS + hourOffset * 60 * 60 * 1000;
        const sessions: SessionForAggregation[] = [
          { id: 's1', workoutId: null, startedAt, endedAt: null },
        ];
        const result = computeWeeklyStreak(sessions, fixedNow);
        return result.every((v) => v === false);
      }),
      { numRuns: 100 },
    );
  });

  it('sessions outside the current week never mark a day as trained', () => {
    const weekStartMs = startOfWeek(FIXED_NOW).getTime();
    fc.assert(
      fc.property(
        fc.integer({ min: -30, max: -1 }).filter((n) => n !== 0),
        (dayOffset) => {
          const startedAt = weekStartMs + dayOffset * DAY_MS;
          const sessions: SessionForAggregation[] = [
            { id: 's1', workoutId: null, startedAt, endedAt: startedAt + 1000 },
          ];
          const result = computeWeeklyStreak(sessions, fixedNow);
          return result.every((v) => v === false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('edge case: Saturday 23:59 and Sunday 00:00 belong to different weeks', () => {
    const weekStart = startOfWeek(FIXED_NOW);
    // Saturday of the current week, 23:59:59.999
    const saturdayEnd = weekStart.getTime() + 6 * DAY_MS + (DAY_MS - 1);
    // Sunday of the NEXT week, 00:00:00.000
    const nextSunday = weekStart.getTime() + 7 * DAY_MS;

    const sessions: SessionForAggregation[] = [
      { id: 's1', workoutId: null, startedAt: saturdayEnd, endedAt: saturdayEnd + 1 },
      { id: 's2', workoutId: null, startedAt: nextSunday, endedAt: nextSunday + 1 },
    ];

    const result = computeWeeklyStreak(sessions, fixedNow);

    // Only Saturday (index 6) of the CURRENT week should be marked; the next week's
    // Sunday session falls outside the current week's range and must not appear.
    expect(result[6]).toBe(true);
    expect(result.filter(Boolean).length).toBe(1);
  });

  it('is a pure function: same inputs always produce same outputs', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.uuid(),
            workoutId: fc.option(fc.uuid(), { nil: null }),
            startedAt: fc.integer({ min: 0, max: 2_000_000_000_000 }),
            endedAt: fc.option(fc.integer({ min: 0, max: 2_000_000_000_000 }), { nil: null }),
          }),
          { maxLength: 20 },
        ),
        (sessions) => {
          const r1 = computeWeeklyStreak(sessions, fixedNow);
          const r2 = computeWeeklyStreak(sessions, fixedNow);
          return JSON.stringify(r1) === JSON.stringify(r2);
        },
      ),
      { numRuns: 100 },
    );
  });
});
