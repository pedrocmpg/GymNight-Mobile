/**
 * computeRadarGeometry — função pura que transforma valores por categoria
 * (ex: volume muscular por grupo) em coordenadas de viewport e paths SVG de
 * um gráfico radar, sem depender de react-native-svg. Mesmo molde de
 * `ProgressScreen/computeChartGeometry.ts`: isola toda a matemática para ser
 * testável com property-based tests sem mock de módulo nativo
 * (PARIDADE-03-ESTATISTICAS.md §2.4 — nada de victory-native/chart-kit).
 */

export interface RadarSlice {
  label: string;
  value: number;
}

export interface RadarViewport {
  width: number;
  height: number;
  /**
   * Fração de `min(width, height) / 2` ocupada pelo polígono; o restante vira
   * espaço para os rótulos fora do anel de 100%. Default 0.7.
   */
  radiusRatio?: number;
}

export interface RadarPoint {
  x: number;
  y: number;
}

export interface RadarGeometry {
  /** Vértices do polígono de dados, na ordem das categorias de entrada. */
  points: RadarPoint[];
  /** Path SVG fechado (M...L...Z) do polígono de dados. */
  polygonPath: string;
  /** Anéis concêntricos em 25/50/75/100% do raio máximo, cada um um path fechado. */
  gridRings: string[];
  /** Um path "M centro L borda" por categoria — os raios do centro à borda. */
  axisLines: string[];
  /** Posição de rótulo por categoria, um pouco além do anel de 100%. */
  labelPositions: Array<{ x: number; y: number; label: string }>;
}

const GRID_RING_FRACTIONS = [0.25, 0.5, 0.75, 1];

/** Ângulo do eixo `i` de `n`: começa no topo (-π/2), sentido horário. */
function angleForIndex(index: number, n: number): number {
  return -Math.PI / 2 + (2 * Math.PI * index) / n;
}

function pointAt(cx: number, cy: number, angle: number, radius: number): RadarPoint {
  return { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) };
}

function closedPolygonPath(points: RadarPoint[]): string {
  if (points.length === 0) return '';
  return `${points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')} Z`;
}

/**
 * Converte valores por categoria em geometria de gráfico radar dentro de um
 * viewport com origem (0,0) no canto superior esquerdo (convenção SVG).
 *
 * - Escala relativa ao MÁXIMO entre as categorias, não ao total: a categoria
 *   mais trabalhada sempre encosta no anel de 100%; as outras são relativas
 *   a ela (PARIDADE-03-ESTATISTICAS.md §2.3).
 * - Todas as categorias zeradas (max = 0) degenera para o centro, sem
 *   dividir por zero.
 * - `n` categorias sempre produzem `n` vértices/eixos, mesmo com 1 categoria
 *   ou com um polígono degenerado (uma só categoria com valor).
 *
 * @param slices - Valores por categoria, na ordem em que os eixos aparecem
 * @param viewport - Dimensões do viewport SVG de destino
 */
export function computeRadarGeometry(
  slices: RadarSlice[],
  viewport: RadarViewport,
): RadarGeometry {
  const n = slices.length;
  if (n === 0) {
    return { points: [], polygonPath: '', gridRings: [], axisLines: [], labelPositions: [] };
  }

  const { width, height } = viewport;
  const radiusRatio = viewport.radiusRatio ?? 0.7;
  const cx = width / 2;
  const cy = height / 2;
  const halfMinDimension = Math.min(width, height) / 2;
  const radiusMax = halfMinDimension * radiusRatio;

  const maxValue = Math.max(0, ...slices.map((s) => s.value));

  const points = slices.map((slice, i) => {
    const radius = maxValue > 0 ? (slice.value / maxValue) * radiusMax : 0;
    return pointAt(cx, cy, angleForIndex(i, n), radius);
  });

  const polygonPath = closedPolygonPath(points);

  const gridRings = GRID_RING_FRACTIONS.map((fraction) =>
    closedPolygonPath(
      slices.map((_, i) => pointAt(cx, cy, angleForIndex(i, n), radiusMax * fraction)),
    ),
  );

  const axisLines = slices.map((_, i) => {
    const outer = pointAt(cx, cy, angleForIndex(i, n), radiusMax);
    return `M${cx},${cy} L${outer.x},${outer.y}`;
  });

  // Rótulo fica entre o anel de 100% e a borda do viewport, nunca além dela
  // (0.6 de folga garante margem mesmo quando radiusRatio está perto de 1).
  const labelRadius = radiusMax + (halfMinDimension - radiusMax) * 0.6;
  const labelPositions = slices.map((slice, i) => {
    const pos = pointAt(cx, cy, angleForIndex(i, n), labelRadius);
    return { x: pos.x, y: pos.y, label: slice.label };
  });

  return { points, polygonPath, gridRings, axisLines, labelPositions };
}
