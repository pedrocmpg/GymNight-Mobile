/**
 * HeroBanner — imagem de fundo com quatro degradês pretos nas bordas e o
 * conteúdo sobreposto. É a peça visual mais característica do desktop.
 * Porta o _HeroBanner (dashboard.py:21-65).
 *
 * No desktop os degradês são pintados com QPainter, cada um indo de
 * rgba(0,0,0,180) na borda até transparente para dentro:
 *
 *   esquerda / direita   100px
 *   topo / base           80px
 *
 * Aqui cada um vira um <Svg> absoluto ocupando só a sua faixa, preenchido
 * por um LinearGradient próprio. Um Svg por faixa evita depender da largura
 * medida do container — cada faixa é dimensionada pelo próprio layout.
 *
 * Usa react-native-svg (já é dependência 15.8.0 e já tem mock de teste) em
 * vez de introduzir expo-linear-gradient.
 */

import React from 'react';
import { View, ImageBackground, StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { colors, radii, spacing } from '../tokens';

export interface HeroBannerProps {
  /** Conteúdo sobreposto — saudação, subtítulo. */
  children: React.ReactNode;
  height?: number;
  testID?: string;
}

/** Opacidade da borda no desktop: 180/255. */
const EDGE_OPACITY = 180 / 255;
const SIDE_WIDTH = 100;
const VERT_HEIGHT = 80;

/**
 * Uma faixa de degradê, da borda para dentro. `x1,y1 -> x2,y2` define a
 * direção; `style` posiciona e dimensiona a faixa sobre o banner.
 */
function Scrim({
  id,
  x1,
  y1,
  x2,
  y2,
  style,
}: {
  id: string;
  x1: string;
  y1: string;
  x2: string;
  y2: string;
  style: object;
}) {
  return (
    <Svg style={[styles.scrim, style]} pointerEvents="none">
      <Defs>
        <LinearGradient id={id} x1={x1} y1={y1} x2={x2} y2={y2}>
          <Stop offset="0" stopColor={colors.scrim} stopOpacity={EDGE_OPACITY} />
          <Stop offset="1" stopColor={colors.scrim} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  );
}

export function HeroBanner({ children, height = 180, testID }: HeroBannerProps) {
  return (
    <ImageBackground
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      source={require('../../../assets/hero-header.png')}
      resizeMode="cover"
      style={[styles.banner, { height }]}
      imageStyle={styles.image}
      testID={testID}
    >
      <Scrim id="heroLeft" x1="0" y1="0" x2="1" y2="0" style={styles.left} />
      <Scrim id="heroRight" x1="1" y1="0" x2="0" y2="0" style={styles.right} />
      <Scrim id="heroTop" x1="0" y1="0" x2="0" y2="1" style={styles.top} />
      <Scrim id="heroBottom" x1="0" y1="1" x2="0" y2="0" style={styles.bottom} />
      <View style={styles.content}>{children}</View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  banner: {
    borderRadius: radii.lg,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  image: {
    borderRadius: radii.lg,
  },
  scrim: {
    position: 'absolute',
  },
  left: { left: 0, top: 0, bottom: 0, width: SIDE_WIDTH },
  right: { right: 0, top: 0, bottom: 0, width: SIDE_WIDTH },
  top: { left: 0, right: 0, top: 0, height: VERT_HEIGHT },
  bottom: { left: 0, right: 0, bottom: 0, height: VERT_HEIGHT },
  // Padding interno do desktop (dashboard.py:290): 32, 28, 32, 28.
  content: {
    paddingHorizontal: spacing.xl,
    paddingVertical: 28,
  },
});
