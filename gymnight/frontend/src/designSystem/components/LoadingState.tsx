/**
 * LoadingState — spinner discreto centralizado no espaço disponível.
 */

import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { colors } from '../tokens';

export interface LoadingStateProps {
  testID?: string;
  indicatorTestID?: string;
}

export function LoadingState({ testID, indicatorTestID }: LoadingStateProps) {
  return (
    <View style={styles.container} testID={testID}>
      <ActivityIndicator testID={indicatorTestID} size="small" color={colors.secondaryText} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
