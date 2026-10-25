/**
 * ExerciseThumb — miniatura de um exercício do catálogo.
 *
 * `animated` troca a JPG estática pela animação (WebP animado embutido). A
 * JPG fica como placeholder, então a troca não pisca. Sem mídia (exercício
 * fora do catálogo de 500, ou catálogo ainda não sincronizado) cai num
 * IconBadge com halter.
 *
 * Com `onPress`, a miniatura vira o atalho para o ExerciseDetailSheet.
 */

import React from 'react';
import { StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { getExerciseMedia } from '../../catalog/exerciseMedia';
import { IconBadge } from '../../designSystem/components/IconBadge';
import { Touchable } from '../../designSystem/components/Touchable';
import { colors, radii } from '../../designSystem/tokens';

export interface ExerciseThumbProps {
  mediaKey?: string | null;
  size: number;
  animated?: boolean;
  onPress?: () => void;
  /** Ex.: "Ver Supino reto com barra". Só usado quando há `onPress`. */
  accessibilityLabel?: string;
  testID?: string;
}

export function ExerciseThumb({
  mediaKey,
  size,
  animated = false,
  onPress,
  accessibilityLabel,
  testID,
}: ExerciseThumbProps) {
  const media = getExerciseMedia(mediaKey);
  const box = { width: size, height: size };

  const content = media ? (
    <Image
      source={animated ? media.anim : media.thumb}
      placeholder={animated ? media.thumb : undefined}
      autoplay={animated}
      contentFit="cover"
      style={[styles.image, box]}
      testID={testID ? `${testID}-image` : undefined}
      accessible={false}
    />
  ) : (
    <IconBadge icon="dumbbell" size={size} testID={testID ? `${testID}-fallback` : undefined} />
  );

  if (!onPress) return content;

  return (
    <Touchable
      onPress={onPress}
      haptic="light"
      style={[styles.touchable, box]}
      accessibilityRole="imagebutton"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
    >
      {content}
    </Touchable>
  );
}

const styles = StyleSheet.create({
  image: {
    borderRadius: radii.md,
    backgroundColor: colors.cardAlt,
  },
  touchable: {
    borderRadius: radii.md,
  },
});
