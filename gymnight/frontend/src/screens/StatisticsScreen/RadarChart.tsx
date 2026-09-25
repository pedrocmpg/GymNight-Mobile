/**
 * RadarChart — polígono de 6 eixos sobre anéis concêntricos (grupos
 * musculares × volume). Toda a geometria vem pré-computada de
 * computeRadarGeometry (função pura, sem import de react-native-svg) — este
 * componente só renderiza (PARIDADE-03-ESTATISTICAS.md §2.4).
 */

import React from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { computeRadarGeometry, type RadarSlice } from './computeRadarGeometry';
import { colors, spacing, typography } from '../../designSystem/tokens';

export interface RadarChartProps {
  slices: RadarSlice[];
  /** Quando ausente, calculado a partir da largura da janela (mesmo padrão
   * do OneRmChart) — um quadrado, para o hexágono não ficar distorcido. */
  size?: number;
  testID?: string;
}

// StatisticsScreen `padding: spacing.md` (×2) + Card `padding: spacing.lg` (×2) + Card `borderWidth: 2` (×2).
const CHART_HORIZONTAL_CHROME = spacing.md * 2 + spacing.lg * 2 + 4;
const MAX_SIZE = 260;
/** Metade da largura reservada para cada rótulo, para centralizá-lo na posição calculada. */
const LABEL_HALF_WIDTH = 32;

export function RadarChart({ slices, size, testID }: RadarChartProps) {
  const { width: windowWidth } = useWindowDimensions();
  const resolvedSize =
    size ?? Math.min(MAX_SIZE, Math.max(windowWidth - CHART_HORIZONTAL_CHROME, 0));

  const geometry = computeRadarGeometry(slices, { width: resolvedSize, height: resolvedSize });

  return (
    <View style={{ width: resolvedSize, height: resolvedSize }} testID={testID}>
      <Svg width={resolvedSize} height={resolvedSize} viewBox={`0 0 ${resolvedSize} ${resolvedSize}`}>
        {geometry.gridRings.map((ring, i) => (
          <Path key={`ring-${i}`} d={ring} fill="none" stroke={colors.border} strokeWidth={1} />
        ))}
        {geometry.axisLines.map((line, i) => (
          <Path key={`axis-${i}`} d={line} stroke={colors.border} strokeWidth={1} />
        ))}
        {geometry.polygonPath !== '' && (
          <Path
            d={geometry.polygonPath}
            fill={colors.primaryMuted}
            fillOpacity={0.6}
            stroke={colors.primary}
            strokeWidth={2}
            strokeLinejoin="round"
          />
        )}
      </Svg>
      {geometry.labelPositions.map((pos, i) => (
        <Text
          key={i}
          style={[
            styles.label,
            { left: pos.x - LABEL_HALF_WIDTH, top: pos.y - typography.caption.fontSize },
          ]}
          numberOfLines={1}
        >
          {pos.label}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    position: 'absolute',
    width: LABEL_HALF_WIDTH * 2,
    textAlign: 'center',
    color: colors.secondaryText,
    ...typography.caption,
  },
});
