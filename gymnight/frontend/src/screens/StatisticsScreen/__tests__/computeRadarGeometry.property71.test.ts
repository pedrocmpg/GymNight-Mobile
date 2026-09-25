/**
 * Property-Based Test — Property 71
 *
 * computeRadarGeometry: a escala é relativa ao MÁXIMO entre as categorias,
 * não ao total — a categoria de maior valor sempre encosta exatamente no
 * anel de 100% (distância do centro == radiusMax).
 *
 * Feature: PARIDADE-03-ESTATISTICAS.md §2.3
 */
import * as fc from 'fast-check';
import { computeRadarGeometry, type RadarSlice } from '@/screens/StatisticsScreen/computeRadarGeometry';

const VIEWPORT = { width: 240, height: 240 };
const RADIUS_MAX = (Math.min(VIEWPORT.width, VIEWPORT.height) / 2) * 0.7; // default radiusRatio

function distanceFromCenter(point: { x: number; y: number }): number {
  const cx = VIEWPORT.width / 2;
  const cy = VIEWPORT.height / 2;
  return Math.hypot(point.x - cx, point.y - cy);
}

const arbSlicesWithPositiveMax = fc
  .array(
    fc.record({
      label: fc.string({ minLength: 1, maxLength: 10 }),
      value: fc.float({ min: 0, max: Math.fround(1000), noNaN: true }),
    }),
    { minLength: 1, maxLength: 12 },
  )
  .filter((slices) => slices.some((s) => s.value > 0));

describe('Property 71: the largest category always touches the 100% ring', () => {
  it('the category with the maximum value sits at exactly radiusMax from the center', () => {
    fc.assert(
      fc.property(arbSlicesWithPositiveMax, (slices: RadarSlice[]) => {
        const geometry = computeRadarGeometry(slices, VIEWPORT);
        const maxValue = Math.max(...slices.map((s) => s.value));
        const maxIndex = slices.findIndex((s) => s.value === maxValue);

        const dist = distanceFromCenter(geometry.points[maxIndex]);
        return Math.abs(dist - RADIUS_MAX) < 1e-6;
      }),
      { numRuns: 200 },
    );
  });

  it('no category ever exceeds radiusMax', () => {
    fc.assert(
      fc.property(arbSlicesWithPositiveMax, (slices: RadarSlice[]) => {
        const geometry = computeRadarGeometry(slices, VIEWPORT);
        return geometry.points.every((p) => distanceFromCenter(p) <= RADIUS_MAX + 1e-6);
      }),
      { numRuns: 200 },
    );
  });

  it('a single category with a value always touches the border (degenerate polygon, still valid)', () => {
    const geometry = computeRadarGeometry([{ label: 'Único', value: 42 }], VIEWPORT);
    expect(distanceFromCenter(geometry.points[0])).toBeCloseTo(RADIUS_MAX, 6);
    expect(geometry.polygonPath).toMatch(/^M[\d.,-]+ Z$/);
  });

  it('doubling every value in lockstep does not change relative scale (still touches 100%)', () => {
    fc.assert(
      fc.property(arbSlicesWithPositiveMax, (slices: RadarSlice[]) => {
        const doubled = slices.map((s) => ({ ...s, value: s.value * 2 }));
        const geometryOriginal = computeRadarGeometry(slices, VIEWPORT);
        const geometryDoubled = computeRadarGeometry(doubled, VIEWPORT);
        for (let i = 0; i < slices.length; i++) {
          const d1 = distanceFromCenter(geometryOriginal.points[i]);
          const d2 = distanceFromCenter(geometryDoubled.points[i]);
          if (Math.abs(d1 - d2) > 1e-6) return false;
        }
        return true;
      }),
      { numRuns: 100 },
    );
  });
});
