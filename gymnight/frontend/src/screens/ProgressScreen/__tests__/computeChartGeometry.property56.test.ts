/**
 * Property-Based Test — Property 56
 *
 * computeChartGeometry: for any valid point series, the generated SVG path has
 * N-1 line segments for N points, X coordinates are monotonically non-decreasing
 * (time flows left to right), and Y coordinates stay within the declared viewport.
 *
 * Feature: dashboard-history-progress
 */
import * as fc from 'fast-check';
import { computeChartGeometry, ChartPoint } from '@/screens/ProgressScreen/computeChartGeometry';

const CHART_VERTICAL_PADDING = 10;
const VIEWPORT = { width: 300, height: 120, paddingY: CHART_VERTICAL_PADDING };

const arbSortedSeries = fc
  .array(
    fc.record({
      timestampMs: fc.integer({ min: 0, max: 1_000_000 }),
      value: fc.float({ min: 0, max: Math.fround(1000), noNaN: true }),
    }),
    { maxLength: 30 },
  )
  .map((points) => [...points].sort((a, b) => a.timestampMs - b.timestampMs));

describe('Property 56: computeChartGeometry', () => {
  it('produces exactly N coordinates for N input points', () => {
    fc.assert(
      fc.property(arbSortedSeries, (series: ChartPoint[]) => {
        const geometry = computeChartGeometry(series, VIEWPORT);
        return geometry.points.length === series.length;
      }),
      { numRuns: 200 },
    );
  });

  it('X coordinates are monotonically non-decreasing', () => {
    fc.assert(
      fc.property(arbSortedSeries, (series: ChartPoint[]) => {
        const geometry = computeChartGeometry(series, VIEWPORT);
        for (let i = 1; i < geometry.points.length; i++) {
          if (geometry.points[i].x < geometry.points[i - 1].x - 1e-9) return false;
        }
        return true;
      }),
      { numRuns: 200 },
    );
  });

  it('Y coordinates always stay within [paddingY, height - paddingY]', () => {
    fc.assert(
      fc.property(arbSortedSeries, (series: ChartPoint[]) => {
        const geometry = computeChartGeometry(series, VIEWPORT);
        return geometry.points.every(
          (p) => p.y >= VIEWPORT.paddingY - 1e-6 && p.y <= VIEWPORT.height - VIEWPORT.paddingY + 1e-6,
        );
      }),
      { numRuns: 200 },
    );
  });

  it('linePath has N-1 "L" segments for N points (plus one leading "M")', () => {
    fc.assert(
      fc.property(arbSortedSeries, (series: ChartPoint[]) => {
        const geometry = computeChartGeometry(series, VIEWPORT);
        if (series.length === 0) return geometry.linePath === '';
        const lCount = (geometry.linePath.match(/L/g) ?? []).length;
        const mCount = (geometry.linePath.match(/M/g) ?? []).length;
        return mCount === 1 && lCount === series.length - 1;
      }),
      { numRuns: 200 },
    );
  });

  it('empty series produces empty geometry', () => {
    const geometry = computeChartGeometry([], VIEWPORT);
    expect(geometry.points).toEqual([]);
    expect(geometry.linePath).toBe('');
    expect(geometry.areaPath).toBe('');
  });

  it('single-point series produces one coordinate and no line segments', () => {
    const geometry = computeChartGeometry([{ timestampMs: 100, value: 50 }], VIEWPORT);
    expect(geometry.points.length).toBe(1);
    expect(geometry.linePath.match(/L/g)).toBeNull();
  });
});
