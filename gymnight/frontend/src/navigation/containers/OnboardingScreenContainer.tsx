import React, { useState } from 'react';
import { OnboardingScreen } from '../../screens/OnboardingScreen/OnboardingScreen';
import { saveOnboardingProfile } from '../../screens/OnboardingScreen/saveOnboardingProfile';
import type { OnboardingProfileData } from '../../screens/OnboardingScreen/saveOnboardingProfile';
import type { SessionStore } from '../../auth/sessionStore';
import { decodeJwtPayload } from '../../auth/jwtTokenValidator';
import database from '../../db/database';

export interface OnboardingScreenContainerProps {
  sessionStore: SessionStore;
  onCompleted: () => void;
}

/**
 * Supplies OnboardingScreen's props from live sources: persiste o perfil via
 * saveOnboardingProfile (upsert em `users`), navegando para a área
 * autenticada só após o commit local ter sucesso.
 *
 * `email` vem do claim `email` do JWT de acesso (mesmo claim que o backend
 * lê em `get_current_user_email`) — só é necessário no caminho de CRIAÇÃO da
 * linha `users` (`users.email` é obrigatório no schema); nunca fica
 * persistido em lugar nenhum além do próprio JWT já armazenado.
 */
export function OnboardingScreenContainer(props: OnboardingScreenContainerProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleComplete = async (data: OnboardingProfileData) => {
    const session = props.sessionStore.getCurrentSession();
    const userId = session?.user_id;
    if (!userId) {
      setError('Sessão inválida. Tente sair e entrar novamente.');
      return;
    }
    const email = (decodeJwtPayload(session.access_token)?.email as string | undefined) ?? '';

    setIsSaving(true);
    setError(null);
    const result = await saveOnboardingProfile(userId, email, data, database);
    setIsSaving(false);

    if (result.success) {
      props.onCompleted();
    } else {
      setError('Falha ao salvar seu perfil. Tente novamente.');
    }
  };

  return <OnboardingScreen onComplete={handleComplete} isSaving={isSaving} error={error} />;
}
