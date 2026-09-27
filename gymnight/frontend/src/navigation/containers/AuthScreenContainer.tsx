import React, { useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { AuthScreen } from '../../screens/AuthScreen/AuthScreen';
import type { AuthManager } from '../../auth/AuthManager';
import type { SessionStore } from '../../auth/sessionStore';
import { signInAndPropagate, signUpAndPropagate } from '../../auth/sessionProducers';
import { resolveSignInOutcome, resolveSignUpOutcome } from '../bootstrapRouting';

export interface AuthScreenContainerProps {
  authManager: AuthManager;
  sessionStore: SessionStore;
  onAuthenticated: () => void;
}

/**
 * Supplies AuthScreen's props from live sources (Requirement 5.3):
 * isOnline via NetInfo, isLoading/error via local state around
 * AuthManager.signIn(), and propagates a successful session to the
 * SessionStore (Requirements 6.5, 6.6, 6.8).
 */
export function AuthScreenContainer(props: AuthScreenContainerProps) {
  const [isOnline, setIsOnline] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signUpStatus, setSignUpStatus] = useState<'idle' | 'confirmationRequired'>('idle');

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOnline(state.isConnected === true);
    });
    return unsubscribe;
  }, []);

  const handleSubmit = async (email: string, password: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await signInAndPropagate(props.authManager, props.sessionStore, email, password);
      const outcome = resolveSignInOutcome(result);
      if (outcome.navigateToDashboard) {
        props.onAuthenticated();
      } else {
        setError(outcome.errorMessage);
      }
    } catch {
      const outcome = resolveSignInOutcome({ __rejected: true });
      setError(outcome.errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (email: string, password: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await signUpAndPropagate(props.authManager, props.sessionStore, email, password);
      const outcome = resolveSignUpOutcome(result);
      if (outcome.navigateToDashboard) {
        props.onAuthenticated();
      } else if (outcome.confirmationRequired) {
        setSignUpStatus('confirmationRequired');
      } else {
        setError(outcome.errorMessage);
      }
    } catch {
      const outcome = resolveSignUpOutcome({ __rejected: true });
      setError(outcome.errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthScreen
      isOnline={isOnline}
      isLoading={isLoading}
      error={error}
      onSubmit={handleSubmit}
      onSignUp={handleSignUp}
      signUpStatus={signUpStatus}
      onDismissCheckEmail={() => setSignUpStatus('idle')}
    />
  );
}
