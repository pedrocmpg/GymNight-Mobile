/**
 * AuthScreen Component
 *
 * Displays login/sign-up form with UI states for loading, offline, and error.
 * Uses Design_Tokens exclusively for styling.
 *
 * Porta o lockup da marca da titlebar do desktop (window.py:94-106),
 * REDESIGN-03-TELAS.md §5.2.
 *
 * Cadastro (mode 'signUp') usa Supabase Auth com confirmação de email
 * obrigatória neste projeto — signUp nunca retorna sessão imediata, então
 * ao concluir o cadastro a tela entra em mode 'checkEmail' (não navega
 * sozinha, já que não há sessão até a confirmação).
 *
 * Props:
 * - isOnline: whether the device is connected
 * - isLoading: whether a request is in flight
 * - error: error message string or null
 * - onSubmit: callback invoked with (email, password) on sign-in submit
 * - onSignUp: callback invoked with (email, password) on sign-up submit
 * - signUpStatus: 'confirmationRequired' switches the screen to the
 *   "check your email" state after a successful sign-up call
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome5 } from '@expo/vector-icons';
import { colors, typography, spacing } from '../../designSystem/tokens';
import { Banner } from '../../designSystem/components/Banner';
import { Input } from '../../designSystem/components/Input';
import { Button } from '../../designSystem/components/Button';
import { isSubmitEnabled, isSignUpSubmitEnabled } from './authValidation';

export type AuthScreenMode = 'signIn' | 'signUp';

export interface AuthScreenProps {
  isOnline: boolean;
  isLoading: boolean;
  error: string | null;
  onSubmit: (email: string, password: string) => void;
  onSignUp: (email: string, password: string) => void;
  signUpStatus?: 'idle' | 'confirmationRequired';
  /** Chamado ao tocar "Já confirmou? Entrar" — o container reseta signUpStatus
   * para 'idle', já que é a prop (não estado interno) que decide mostrar
   * este modo (senão o botão nunca conseguiria de fato sair dele). */
  onDismissCheckEmail: () => void;
}

export function AuthScreen({
  isOnline,
  isLoading,
  error,
  onSubmit,
  onSignUp,
  signUpStatus = 'idle',
  onDismissCheckEmail,
}: AuthScreenProps) {
  const [mode, setMode] = useState<AuthScreenMode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const canSubmit = isSubmitEnabled(email, password) && isOnline && !isLoading;
  const canSignUp =
    isSignUpSubmitEnabled(email, password, confirmPassword) && isOnline && !isLoading;

  const handleSubmit = () => {
    if (!canSubmit) return;
    onSubmit(email, password);
  };

  const handleSignUp = () => {
    if (!canSignUp) return;
    onSignUp(email, password);
  };

  if (signUpStatus === 'confirmationRequired') {
    return (
      <SafeAreaView style={styles.container} edges={['top']} testID="auth-screen">
        <View style={styles.brand}>
          <FontAwesome5 name="bolt" size={18} color={colors.primary} solid />
          <Text style={styles.brandName}>GYMNight</Text>
        </View>

        <Banner
          message={`Confirme seu email para continuar. Enviamos um link de confirmação para ${email}.`}
          variant="info"
          testID="check-email-banner"
        />

        <Button
          testID="back-to-sign-in-button"
          label="Já confirmou? Entrar"
          variant="ghost"
          onPress={() => {
            setMode('signIn');
            onDismissCheckEmail();
          }}
        />
      </SafeAreaView>
    );
  }

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

      {mode === 'signUp' && (
        <Input
          testID="confirm-password-input"
          placeholder="Confirmar senha"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          editable={!isLoading}
        />
      )}

      {mode === 'signIn' ? (
        <>
          <Button
            testID="submit-button"
            label="Entrar"
            onPress={handleSubmit}
            disabled={!canSubmit}
            loading={isLoading}
            accessibilityLabel="submit"
            style={styles.submitButton}
          />
          <TouchableOpacity testID="go-to-sign-up-link" onPress={() => setMode('signUp')}>
            <Text style={styles.linkText}>Não tem conta? Cadastre-se</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <Button
            testID="sign-up-button"
            label="Cadastrar"
            onPress={handleSignUp}
            disabled={!canSignUp}
            loading={isLoading}
            accessibilityLabel="sign up"
            style={styles.submitButton}
          />
          <TouchableOpacity testID="go-to-sign-in-link" onPress={() => setMode('signIn')}>
            <Text style={styles.linkText}>Já tem conta? Entrar</Text>
          </TouchableOpacity>
        </>
      )}
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
  linkText: {
    ...typography.caption,
    color: colors.primary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});
