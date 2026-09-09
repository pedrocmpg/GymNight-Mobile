/**
 * AuthScreen Component
 *
 * Displays login/sign-up form with UI states for loading, offline, and error.
 * Uses Design_Tokens exclusively for styling.
 *
 * Porta o lockup da marca da titlebar do desktop (window.py:94-106),
 * REDESIGN-03-TELAS.md §5.2. Não há cadastro nem "esqueci a senha" —
 * fora do escopo deste redesign (REDESIGN-VISUAL.md §6).
 *
 * Props:
 * - isOnline: whether the device is connected
 * - isLoading: whether a request is in flight
 * - error: error message string or null
 * - onSubmit: callback invoked with (email, password) on form submit
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome5 } from '@expo/vector-icons';
import { colors, typography, spacing } from '../../designSystem/tokens';
import { Banner } from '../../designSystem/components/Banner';
import { Input } from '../../designSystem/components/Input';
import { Button } from '../../designSystem/components/Button';
import { isSubmitEnabled } from './authValidation';

export interface AuthScreenProps {
  isOnline: boolean;
  isLoading: boolean;
  error: string | null;
  onSubmit: (email: string, password: string) => void;
}

export function AuthScreen({
  isOnline,
  isLoading,
  error,
  onSubmit,
}: AuthScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const canSubmit = isSubmitEnabled(email, password) && isOnline && !isLoading;

  const handleSubmit = () => {
    if (!canSubmit) return;
    onSubmit(email, password);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']} testID="auth-screen">
      {/* Lockup da marca — window.py:94-106 */}
      <View style={styles.brand}>
        <FontAwesome5 name="bolt" size={18} color={colors.primary} solid />
        <Text style={styles.brandName}>GYMNight</Text>
      </View>

      {/* Offline Banner */}
      {!isOnline && (
        <Banner
          message="Sem conexão. Autenticação requer internet."
          variant="info"
          testID="offline-banner"
        />
      )}

      {/* Error Banner */}
      {error && <Banner message={error} variant="error" testID="error-banner" />}

      {/* Email Input */}
      <Input
        testID="email-input"
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        editable={!isLoading}
      />

      {/* Password Input */}
      <Input
        testID="password-input"
        placeholder="Senha"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        editable={!isLoading}
      />

      {/* Submit Button */}
      <Button
        testID="submit-button"
        label="Entrar"
        onPress={handleSubmit}
        disabled={!canSubmit}
        loading={isLoading}
        accessibilityLabel="submit"
        style={styles.submitButton}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.md,
    justifyContent: 'center',
    gap: spacing.sm,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginBottom: spacing.lg,
  },
  brandName: {
    ...typography.h3,
    fontFamily: typography.h2.fontFamily,
    fontSize: 15,
    color: colors.primaryText,
    letterSpacing: 1,
  },
  submitButton: {
    marginTop: spacing.xs,
  },
});
