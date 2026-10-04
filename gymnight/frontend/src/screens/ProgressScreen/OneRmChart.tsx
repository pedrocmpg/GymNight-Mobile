/**
 * OneRmChart — gráfico de linha (SVG) da evolução do 1RM estimado para um
 * exercício. Toda a geometria vem pré-computada de computeChartGeometry (função
 * pura, sem import de react-native-svg) — este componente só renderiza.
 */

import React from 'react';
import { View, useWindowDimensions } from 'react-native';
import Svg, { Path, Circle, Line, Defs, LinearGradient, Stop } from 'react-native-svg';
import { computeChartGeometry, type ChartPoint } from './computeChartGeometry';
import { colors, layout } from '../../designSystem/tokens';

export interface OneRmChartProps {
  series: ChartPoint[];
  /** Quando ausente, calculado a partir da largura da janela menos o padding
   * horizontal do container (gutter da tela + padding do card) —
   * antes era `300` fixo, ignorando o tamanho real do device. */
  width?: number;
  height?: number;
  testID?: string;
}

const GRADIENT_ID = 'oneRmAreaFill';
const CHART_VERTICAL_PADDING = 10;
// Gutter da tela (×2) + padding do Card (×2); cards não têm borda.
const CHART_HORIZONTAL_CHROME = layout.gutter * 2 + layout.cardPadding * 2;

export function OneRmChart({ series, width, height = 120, testID }: OneRmChartProps) {
  const { width: windowWidth } = useWindowDimensions();
  const resolvedWidth = width ?? Math.max(windowWidth - CHART_HORIZONTAL_CHROME, 0);
  const geometry = computeChartGeometry(series, {
    width: resolvedWidth,
    height,
    paddingY: CHART_VERTICAL_PADDING,
  });

  return (
    <View testID={testID}>
      <Svg width={resolvedWidth} height={height} viewBox={`0 0 ${resolvedWidth} ${height}`}>
        <Defs>
          <LinearGradient id={GRADIENT_ID} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={colors.primary} stopOpacity={0.18} />
            <Stop offset="100%" stopColor={colors.primary} stopOpacity={0} />
          </LinearGradient>
        </Defs>
                {/* Duas guias discretas — referência sem ruído. */}
        <Line x1={0} y1={height / 3} x2={resolvedWidth} y2={height / 3} stroke={colors.divider} strokeWidth={1} />
        <Line x1={0} y1={(height * 2) / 3} x2={resolvedWidth} y2={(height * 2) / 3} stroke={colors.divider} strokeWidth={1} />
        {geometry.areaPath !== '' && (
          <Path d={geometry.areaPath} fill={`url(#${GRADIENT_ID})`} />
        )}
        {geometry.linePath !== '' && (
          <Path
            d={geometry.linePath}
            fill="none"
            stroke={colors.primary}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
        {geometry.points.map((point, index) => {
          const isLast = index === geometry.points.length - 1;
          return (
            <Circle
              key={index}
              cx={point.x}
              cy={point.y}
              r={isLast ? 5 : 2}
              fill={isLast ? colors.card : colors.primary}
              stroke={colors.primary}
              strokeWidth={isLast ? 2 : 0}
            />
          );
        })}
      </Svg>
    </View>
  );
}
