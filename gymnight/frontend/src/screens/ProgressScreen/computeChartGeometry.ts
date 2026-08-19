/**
 * computeChartGeometry — função pura que transforma uma série temporal de pontos
 * (ex: evolução de 1RM) em coordenadas de viewport e um path SVG, sem depender de
 * react-native-svg. Isola toda a matemática do gráfico para ser testável com
 * property-based tests sem precisar de mock de módulo nativo.
 */

export interface ChartPoint {
  timestampMs: number;
  value: number;
}

export interface ChartViewport {
  width: number;
  height: number;
  /** Padding vertical reservado no topo/base do viewport, em px. */
  paddingY?: number;
}

export interface ChartCoordinate {
  x: number;
  y: number;
}

export interface ChartGeometry {
  /** Coordenadas de cada ponto, na ordem de entrada (tempo crescente). */
  points: ChartCoordinate[];
  /** Path SVG (comando "M x,y L x,y ...") ligando os pontos. */
  linePath: string;
  /** Path SVG fechado (área sob a curva), útil para preenchimento com gradiente. */
  areaPath: string;
}

/**
 * Converte uma série temporal (ordenada por tempo crescente) em geometria de
 * gráfico de linha dentro de um viewport com origem (0,0) no canto superior
 * esquerdo — convenção padrão SVG (Y cresce para baixo).
 *
 * - Coordenadas X são estritamente não-decrescentes (tempo cresce da esquerda pra
 *   direita); pontos com o mesmo timestampMs recebem o mesmo X.
 * - Coordenadas Y ficam sempre dentro de [paddingY, height - paddingY].
 * - Série vazia produz geometria vazia (paths vazios); série com 1 ponto produz um
 *   único ponto centralizado verticalmente, sem segmento de linha.
 *
 * @param series - Pontos ordenados por timestampMs crescente
 * @param viewport - Dimensões do viewport SVG de destino
 * @returns Geometria pronta para renderização (coordenadas + paths SVG)
 */
export function computeChartGeometry(series: ChartPoint[], viewport: ChartViewport): ChartGeometry {
  const { width, height } = viewport;
  const paddingY = viewport.paddingY ?? 0;
  const usableHeight = Math.max(0, height - 2 * paddingY);

  if (series.length === 0) {
    return { points: [], linePath: '', areaPath: '' };
  }

  const minTime = series[0].timestampMs;
  const maxTime = series[series.length - 1].timestampMs;
  const timeRange = maxTime - minTime;

  const values = series.map((p) => p.value);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const valueRange = maxValue - minValue;

  const points: ChartCoordinate[] = series.map((p, index) => {
    const x = timeRange === 0
      ? (series.length === 1 ? width / 2 : (index / (series.length - 1)) * width)
      : ((p.timestampMs - minTime) / timeRange) * width;

    // Y invertido: valor maior = mais perto do topo (Y menor).
    const y = valueRange === 0
      ? paddingY + usableHeight / 2
      : paddingY + usableHeight - ((p.value - minValue) / valueRange) * usableHeight;

    return { x, y };
  });

  const linePath = points
    .map((pt, i) => `${i === 0 ? 'M' : 'L'}${pt.x},${pt.y}`)
    .join(' ');

  const areaPath = points.length === 0
    ? ''
    : `${linePath} L${points[points.length - 1].x},${height} L${points[0].x},${height} Z`;

  return { points, linePath, areaPath };
}
