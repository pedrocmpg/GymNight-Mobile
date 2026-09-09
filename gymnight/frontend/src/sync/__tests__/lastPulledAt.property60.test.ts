/**
 * Property 60: lastPulledAt — round-trip salvar → hidratar → ler devolve o
 * mesmo valor; clearLastPulledAt limpa memória E storage (Wave 4.5 §2.3).
 */
import { fcAssert, fcAsyncProperty, fc } from '@/test/fcConfig';
import * as SecureStore from 'expo-secure-store';
import { __resetStore } from '../../test/mocks/expoSecureStore';
import { loadLastPulledAt, saveLastPulledAt, clearLastPulledAt, hydrateLastPulledAt } from '../lastPulledAt';

const STORAGE_KEY = 'gymnight.sync.lastPulledAt';

describe('Property 60: lastPulledAt — round-trip e clear', () => {
  beforeEach(() => {
    clearLastPulledAt();
    __resetStore();
  });

  it('save escreve no SecureStore; hidratar a memória a partir dele devolve o mesmo timestamp', async () => {
    await fcAssert(
      fcAsyncProperty(fc.integer({ min: 0, max: Number.MAX_SAFE_INTEGER }), async (timestamp) => {
        clearLastPulledAt();
        __resetStore();

        // Simula o que uma sessão anterior teria persistido — escreve direto
        // no SecureStore (não via saveLastPulledAt, que também tocaria a
        // memória, o que mascararia o que hydrate de fato faz).
        await SecureStore.setItemAsync(STORAGE_KEY, String(timestamp));
        expect(loadLastPulledAt()).toBeNull();

        await hydrateLastPulledAt();

        expect(loadLastPulledAt()).toBe(timestamp);
      }),
    );
  });

  it('saveLastPulledAt persiste no SecureStore (round-trip completo via save→hydrate)', async () => {
    saveLastPulledAt(999999);
    expect(loadLastPulledAt()).toBe(999999);

    const raw = await SecureStore.getItemAsync(STORAGE_KEY);
    expect(raw).toBe('999999');

    await hydrateLastPulledAt();
    expect(loadLastPulledAt()).toBe(999999);
  });

  it('clearLastPulledAt limpa memória E storage — hidratar depois continua null', async () => {
    saveLastPulledAt(12345);
    expect(loadLastPulledAt()).toBe(12345);

    clearLastPulledAt();
    expect(loadLastPulledAt()).toBeNull();

    await hydrateLastPulledAt();
    expect(loadLastPulledAt()).toBeNull();
  });

  it('hidratar sem nada persistido mantém null (nunca sincronizou)', async () => {
    await hydrateLastPulledAt();
    expect(loadLastPulledAt()).toBeNull();
  });

  it('hidratar com lixo não numérico persistido mantém null, não NaN', async () => {
    await SecureStore.setItemAsync(STORAGE_KEY, 'not-a-number');
    await hydrateLastPulledAt();
    expect(loadLastPulledAt()).toBeNull();
  });
});
