/**
 * Property-Based Test — Property 69
 *
 * computeRadarGeometry: para qualquer número de categorias, gera exatamente
 * `n` vértices/eixos/rótulos, e todo ponto do polígono e do rótulo fica
 * dentro do viewport declarado.
 *
 * Feature: PARIDADE-03-ESTATISTICAS.md §2.5, §7
 */
import * as fc from 'fast-check';
import { computeRadarGeometry, type RadarSlice } from '@/screens/StatisticsScreen/computeRadarGeometry';

const VIEWPORT = { width: 240, height: 240 };

const arbSlices = fc.array(
  fc.record({
    label: fc.string({ minLength: 1, maxLength: 10 }),
    value: fc.float({ min: 0, max: Math.fround(1000), noNaN: true }),
  }),
  { minLength: 1, maxLength: 12 },
);

describe('Property 69: computeRadarGeometry produces N vertices for N categories, all inside the viewport', () => {
  it('produces exactly N points, N axis lines and N label positions for N slices', () => {
    fc.assert(
      fc.property(arbSlices, (slices: RadarSlice[]) => {
        const geometry = computeRadarGeometry(slices, VIEWPORT);
        return (
          geometry.points.length === slices.length &&
          geometry.axisLines.length === slices.length &&
          geometry.labelPositions.length === slices.length
        );
      }),
      { numRuns: 200 },
    );
  });

  it('every polygon point stays within the viewport bounds', () => {
    fc.assert(
      fc.property(arbSlices, (slices: RadarSlice[]) => {
        const geometry = computeRadarGeometry(slices, VIEWPORT);
        return geometry.points.every(
          (p) => p.x >= 0 && p.x <= VIEWPORT.width && p.y >= 0 && p.y <= VIEWPORT.height,
        );
      }),
      { numRuns: 200 },
    );
  });

  it('every label position stays within the viewport bounds', () => {
    fc.assert(
      fc.property(arbSlices, (slices: RadarSlice[]) => {
        const geometry = computeRadarGeometry(slices, VIEWPORT);
        return geometry.labelPositions.every(
          (p) => p.x >= 0 && p.x <= VIEWPORT.width && p.y >= 0 && p.y <= VIEWPORT.height,
        );
      }),
      { numRuns: 200 },
    );
  });

  it('always produces exactly 4 grid rings, regardless of category count', () => {
    fc.assert(
      fc.property(arbSlices, (slices: RadarSlice[]) => {
        const geometry = computeRadarGeometry(slices, VIEWPORT);
        return geometry.gridRings.length === 4;
      }),
      { numRuns: 100 },
    );
  });

  it('empty categories produce empty geometry', () => {
    const geometry = computeRadarGeometry([], VIEWPORT);
    expect(geometry.points).toEqual([]);
    expect(geometry.polygonPath).toBe('');
    expect(geometry.gridRings).toEqual([]);
    expect(geometry.axisLines).toEqual([]);
    expect(geometry.labelPositions).toEqual([]);
  });
});
