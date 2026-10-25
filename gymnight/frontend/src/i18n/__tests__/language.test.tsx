import React from 'react';
import { Text } from 'react-native';
import { act, render } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import { loadLanguage, saveLanguage } from '../language';
import { LanguageProvider, useLanguage } from '../LanguageContext';

const resetStore = (SecureStore as unknown as { __resetStore: () => void }).__resetStore;

beforeEach(() => resetStore());

describe('language persistence', () => {
  it('defaults to PT when nothing was saved', async () => {
    await expect(loadLanguage()).resolves.toBe('pt');
  });

  it('round-trips the saved language', async () => {
    await saveLanguage('en');
    await expect(loadLanguage()).resolves.toBe('en');
  });

  it('ignores an invalid saved value', async () => {
    await SecureStore.setItemAsync('gymnight.language', 'fr');
    await expect(loadLanguage()).resolves.toBe('pt');
  });
});

function Probe({ onReady }: { onReady?: (setter: (l: 'pt' | 'en') => void) => void }) {
  const { language, setLanguage } = useLanguage();
  onReady?.(setLanguage);
  return <Text testID="language">{language}</Text>;
}

describe('LanguageProvider', () => {
  it('starts in PT and switches to the saved language once it loads', async () => {
    await saveLanguage('en');
    const screen = render(
      <LanguageProvider>
        <Probe />
      </LanguageProvider>,
    );
    await act(async () => {});
    expect(screen.getByTestId('language').props.children).toBe('en');
  });

  it('setLanguage updates the tree and persists the choice', async () => {
    let setter: ((l: 'pt' | 'en') => void) | undefined;
    const screen = render(
      <LanguageProvider>
        <Probe onReady={(s) => (setter = s)} />
      </LanguageProvider>,
    );
    await act(async () => {});
    await act(async () => setter?.('en'));
    expect(screen.getByTestId('language').props.children).toBe('en');
    await expect(loadLanguage()).resolves.toBe('en');
  });

  it('falls back to PT outside a provider', () => {
    const screen = render(<Probe />);
    expect(screen.getByTestId('language').props.children).toBe('pt');
  });
});
