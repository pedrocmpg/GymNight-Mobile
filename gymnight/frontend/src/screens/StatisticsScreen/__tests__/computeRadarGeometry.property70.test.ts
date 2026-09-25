/**
 * Property-Based Test — Property 70
 *
 * computeRadarGeometry: quando todas as categorias estão zeradas (max = 0), a
 * geometria degenera para o centro sem dividir por zero — nenhum NaN/Infinity
 * em nenhum ponto, e o path continua uma string SVG válida.
 *
 * Feature: PARIDADE-03-ESTATISTICAS.md §2.5 ("⚠️ Casos de borda")
 */
import * as fc from 'fast-check';
import { computeRadarGeometry } from '@/screens/StatisticsScreen/computeRadarGeometry';

const VIEWPORT = { width: 240, height: 240 };

const arbZeroSlices = fc
  .array(fc.string({ minLength: 1, maxLength: 10 }), { minLength: 1, maxLength: 12 })
  .map((labels) => labels.map((label) => ({ label, value: 0 })));

describe('Property 70: all categories zeroed degenerates to the center without dividing by zero', () => {
  it('never produces NaN/Infinity coordinates when every value is 0', () => {
    fc.assert(
      fc.property(arbZeroSlices, (slices) => {
        const geometry = computeRadarGeometry(slices, VIEWPORT);
        return geometry.points.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
      }),
      { numRuns: 100 },
    );
  });

  it('every point sits exactly at the viewport center when all values are 0', () => {
    fc.assert(
      fc.property(arbZeroSlices, (slices) => {
        const geometry = computeRadarGeometry(slices, VIEWPORT);
        const cx = VIEWPORT.width / 2;
        const cy = VIEWPORT.height / 2;
        return geometry.points.every(
          (p) => Math.abs(p.x - cx) < 1e-9 && Math.abs(p.y - cy) < 1e-9,
        );
      }),
      { numRuns: 100 },
    );
  });

  it('the polygon path is still a well-formed, non-empty SVG path', () => {
    fc.assert(
      fc.property(arbZeroSlices, (slices) => {
        const geometry = computeRadarGeometry(slices, VIEWPORT);
        return /^M[\d.,-]+( L[\d.,-]+)* Z$/.test(geometry.polygonPath);
      }),
      { numRuns: 100 },
    );
  });

  it('a single zeroed category also degenerates cleanly (n=1 edge case)', () => {
    const geometry = computeRadarGeometry([{ label: 'Único', value: 0 }], VIEWPORT);
    expect(geometry.points).toHaveLength(1);
    expect(Number.isFinite(geometry.points[0].x)).toBe(true);
    expect(Number.isFinite(geometry.points[0].y)).toBe(true);
  });
});
