/**
 * AuthScreen Component
 *
 * Displays login/sign-up form with UI states for loading, offline, and error.
 * Uses Design_Tokens exclusively for styling.
 *
 * Props:
 * - isOnline: whether the device is connected
 * - isLoading: whether a request is in flight
 * - error: error message string or null
 * - onSubmit: callback invoked with (email, password) on form submit
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { colors, typography, spacing, radii } from '../../designSystem/tokens';
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
    <View style={styles.container} testID="auth-screen">
      {/* Offline Banner */}
      {!isOnline && (
        <View style={styles.offlineBanner} testID="offline-banner">
          <Text style={styles.offlineBannerText}>
            Sem conexão. Autenticação requer internet.
          </Text>
        </View>
      )}

      {/* Error Banner */}
      {error && (
        <View style={styles.errorBanner} testID="error-banner">
          <Text style={styles.errorBannerText}>{error}</Text>
        </View>
      )}

      {/* Email Input */}
      <TextInput
        testID="email-input"
        style={styles.input}
        placeholder="Email"
        placeholderTextColor={colors.secondaryText}
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        editable={!isLoading}
      />

      {/* Password Input */}
      <TextInput
        testID="password-input"
        style={styles.input}
        placeholder="Senha"
        placeholderTextColor={colors.secondaryText}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        editable={!isLoading}
      />

      {/* Submit Button */}
      <TouchableOpacity
        testID="submit-button"
        style={[styles.button, !canSubmit && styles.buttonDisabled]}
        onPress={handleSubmit}
        disabled={!canSubmit}
        accessibilityLabel="submit"
      >
        {isLoading ? (
          <ActivityIndicator
            testID="loading-indicator"
            color={colors.background}
          />
        ) : (
          <Text style={styles.buttonText}>Entrar</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.md,
    justifyContent: 'center',
  },
  offlineBanner: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  offlineBannerText: {
    color: colors.primary,
    ...typography.body,
  },
  errorBanner: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    borderLeftWidth: 4,
    borderLeftColor: colors.error,
  },
  errorBannerText: {
    color: colors.error,
    ...typography.body,
  },
  input: {
    backgroundColor: colors.surface,
    color: colors.primaryText,
    borderRadius: radii.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    ...typography.body,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    padding: spacing.sm,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: colors.background,
    ...typography.body,
    fontWeight: '700',
  },
});
