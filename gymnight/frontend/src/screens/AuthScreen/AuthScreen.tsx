/**
 * AuthScreen Component
 *
 * Entrar / criar conta, centralizado verticalmente: lockup da marca, título
 * que diz o que a tela faz, campos com label e um único CTA lima. A troca de
 * modo é um link discreto logo abaixo. Uses Design_Tokens exclusively.
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
import { View, Text, StyleSheet } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { colors, typography, spacing, radii } from '../../designSystem/tokens';
import { animateLayout } from '../../designSystem/motion';
import { Banner } from '../../designSystem/components/Banner';
import { Input } from '../../designSystem/components/Input';
import { Button } from '../../designSystem/components/Button';
import { Screen } from '../../designSystem/components/Screen';
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

/** Lockup da marca: raio lima + nome. */
function BrandLockup() {
  return (
    <View style={styles.brand}>
      <View style={styles.brandMark}>
        <FontAwesome5 name="bolt" size={16} color={colors.onPrimary} solid />
      </View>
      <Text style={styles.brandName}>GymNight</Text>
    </View>
  );
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

  const switchMode = (next: AuthScreenMode) => {
    animateLayout();
    setMode(next);
  };

  if (signUpStatus === 'confirmationRequired') {
    return (
      <Screen edges={['top', 'bottom']} testID="auth-screen" contentStyle={styles.centered}>
        <BrandLockup />
        <View style={styles.checkEmail}>
          <View style={styles.checkEmailIcon}>
            <FontAwesome5 name="envelope-open-text" size={24} color={colors.primary} solid />
          </View>
          <View style={styles.heading}>
            <Text style={styles.title} accessibilityRole="header">
              Verifique seu email
            </Text>
          </View>
          <Banner
            message={`Confirme seu email para continuar. Enviamos um link de confirmação para ${email}.`}
            variant="info"
            testID="check-email-banner"
          />
        </View>
        <Button
          testID="back-to-sign-in-button"
          label="Já confirmou? Entrar"
          variant="secondary"
          onPress={() => {
            setMode('signIn');
            onDismissCheckEmail();
          }}
        />
      </Screen>
    );
  }

  const isSignIn = mode === 'signIn';

  return (
    <Screen edges={['top', 'bottom']} testID="auth-screen" contentStyle={styles.centered}>
      <View style={styles.intro}>
        <BrandLockup />
        <View style={styles.heading}>
          <Text style={styles.title} accessibilityRole="header">
            {isSignIn ? 'Entre na sua conta' : 'Crie sua conta'}
          </Text>
          <Text style={styles.subtitle}>
            {isSignIn
              ? 'Seus treinos ficam salvos no aparelho e sincronizados na nuvem.'
              : 'Leva menos de um minuto. Você confirma pelo email.'}
          </Text>
        </View>
      </View>

      <View style={styles.form}>
        {!isOnline && (
          <Banner
            message="Sem conexão. Autenticação requer internet."
            variant="info"
            testID="offline-banner"
          />
        )}
        {error && <Banner message={error} variant="error" testID="error-banner" />}

        <Input
          testID="email-input"
          label="Email"
          placeholder="voce@email.com"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
          editable={!isLoading}
        />
        <Input
          testID="password-input"
          label="Senha"
          placeholder="Sua senha"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete={isSignIn ? 'current-password' : 'new-password'}
          textContentType={isSignIn ? 'password' : 'newPassword'}
          editable={!isLoading}
        />
        {!isSignIn && (
          <Input
            testID="confirm-password-input"
            label="Confirmar senha"
            placeholder="Repita a senha"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            autoComplete="new-password"
            textContentType="newPassword"
            editable={!isLoading}
          />
        )}

        <View style={styles.actions}>
          {isSignIn ? (
            <>
              <Button
                testID="submit-button"
                label="Entrar"
                onPress={handleSubmit}
                disabled={!canSubmit}
                loading={isLoading}
                accessibilityLabel="submit"
              />
              <Button
                testID="go-to-sign-up-link"
                label="Não tem conta? Cadastre-se"
                variant="ghost"
                size="sm"
                onPress={() => switchMode('signUp')}
              />
            </>
          ) : (
            <>
              <Button
                testID="sign-up-button"
                label="Criar conta"
                onPress={handleSignUp}
                disabled={!canSignUp}
                loading={isLoading}
                accessibilityLabel="sign up"
              />
              <Button
                testID="go-to-sign-in-link"
                label="Já tem conta? Entrar"
                variant="ghost"
                size="sm"
                onPress={() => switchMode('signIn')}
              />
            </>
          )}
        </View>
      </View>
    </Screen>
  );
}

const BRAND_MARK_SIZE = 32;
const CHECK_EMAIL_ICON_SIZE = 56;

const styles = StyleSheet.create({
  centered: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  intro: {
    gap: spacing.xl,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  brandMark: {
    width: BRAND_MARK_SIZE,
    height: BRAND_MARK_SIZE,
    borderRadius: radii.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandName: {
    ...typography.h3,
    color: colors.primaryText,
  },
  heading: {
    gap: spacing.xs,
  },
  title: {
    ...typography.title,
    color: colors.primaryText,
  },
  subtitle: {
    ...typography.body,
    color: colors.secondaryText,
  },
  form: {
    gap: spacing.md,
  },
  actions: {
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  checkEmail: {
    gap: spacing.lg,
  },
  checkEmailIcon: {
    width: CHECK_EMAIL_ICON_SIZE,
    height: CHECK_EMAIL_ICON_SIZE,
    borderRadius: radii.pill,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
