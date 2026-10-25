/**
 * Contexto do idioma do app. Montado uma vez na raiz (App.tsx); começa no
 * padrão (PT) e troca para o salvo assim que o SecureStore responde.
 *
 * Fora de um provider, `useLanguage()` devolve PT e um setter que não faz
 * nada — telas renderizadas isoladamente (testes) continuam funcionando.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { DEFAULT_LANGUAGE, loadLanguage, saveLanguage, type AppLanguage } from './language';

export interface LanguageContextValue {
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => void;
}

const LanguageContext = createContext<LanguageContextValue>({
  language: DEFAULT_LANGUAGE,
  setLanguage: () => {},
});

export interface LanguageProviderProps {
  children: React.ReactNode;
}

export function LanguageProvider({ children }: LanguageProviderProps) {
  const [language, setLanguageState] = useState<AppLanguage>(DEFAULT_LANGUAGE);
  // Uma escolha do usuário antes do load terminar não pode ser sobrescrita
  // pelo valor antigo que o load trouxer.
  const chosenRef = React.useRef(false);

  useEffect(() => {
    let cancelled = false;
    void loadLanguage().then((saved) => {
      if (!cancelled && !chosenRef.current) setLanguageState(saved);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const setLanguage = useCallback((next: AppLanguage) => {
    chosenRef.current = true;
    setLanguageState(next);
    void saveLanguage(next).catch(() => {});
  }, []);

  const value = useMemo(() => ({ language, setLanguage }), [language, setLanguage]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  return useContext(LanguageContext);
}
