/**
 * OneRmChart — gráfico de linha (SVG) da evolução do 1RM estimado para um
 * exercício. Toda a geometria vem pré-computada de computeChartGeometry (função
 * pura, sem import de react-native-svg) — este componente só renderiza.
 */

import React from 'react';
import { View } from 'react-native';
import Svg, { Path, Circle, Line, Defs, LinearGradient, Stop } from 'react-native-svg';
import { computeChartGeometry, type ChartPoint } from './computeChartGeometry';
import { colors } from '../../designSystem/tokens';

export interface OneRmChartProps {
  series: ChartPoint[];
  width?: number;
  height?: number;
  testID?: string;
}

const GRADIENT_ID = 'oneRmAreaFill';
const CHART_VERTICAL_PADDING = 10;

export function OneRmChart({ series, width = 300, height = 120, testID }: OneRmChartProps) {
  const geometry = computeChartGeometry(series, { width, height, paddingY: CHART_VERTICAL_PADDING });

  return (
    <View testID={testID}>
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <Defs>
          <LinearGradient id={GRADIENT_ID} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={colors.primary} stopOpacity={0.28} />
            <Stop offset="100%" stopColor={colors.primary} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Line x1={0} y1={height * 0.25} x2={width} y2={height * 0.25} stroke="#232B35" strokeWidth={1} />
        <Line x1={0} y1={height * 0.5} x2={width} y2={height * 0.5} stroke="#232B35" strokeWidth={1} />
        <Line x1={0} y1={height * 0.75} x2={width} y2={height * 0.75} stroke="#232B35" strokeWidth={1} />
        {geometry.areaPath !== '' && (
          <Path d={geometry.areaPath} fill={`url(#${GRADIENT_ID})`} />
        )}
        {geometry.linePath !== '' && (
          <Path
            d={geometry.linePath}
            fill="none"
            stroke={colors.primary}
            strokeWidth={2.5}
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
              r={isLast ? 5 : 3}
              fill={isLast ? colors.background : colors.primary}
              stroke={colors.primary}
              strokeWidth={isLast ? 2.5 : 0}
            />
          );
        })}
      </Svg>
    </View>
  );
}
