/**
 * Property 59: useSyncTrigger — timer fixo de 30s só dispara em foreground E
 * online; não dispara em background nem offline (Wave 4.5 §1.4.2).
 */
import { renderHook, act } from '@testing-library/react-native';
import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { useSyncTrigger } from '../useSyncTrigger';
import type { SyncEngine } from '../SyncEngine';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockAppState = AppState as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockNetInfo = NetInfo as any;

function makeSyncEngineStub() {
  const requestSyncCycle = jest.fn().mockResolvedValue(undefined);
  return { requestSyncCycle } as unknown as SyncEngine;
}

describe('Property 59: useSyncTrigger — timer de 30s respeita foreground+online', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockAppState.__reset();
    mockNetInfo.__reset();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('dispara a cada 30s quando em foreground e online', () => {
    const engine = makeSyncEngineStub();
    renderHook(() => useSyncTrigger(engine));

    act(() => {
      jest.advanceTimersByTime(30000);
    });
    expect(engine.requestSyncCycle).toHaveBeenCalledTimes(1);

    act(() => {
      jest.advanceTimersByTime(30000);
    });
    expect(engine.requestSyncCycle).toHaveBeenCalledTimes(2);
  });

  it('não dispara enquanto o app está em background', () => {
    const engine = makeSyncEngineStub();
    renderHook(() => useSyncTrigger(engine));

    act(() => {
      mockAppState.__setState('background');
    });
    act(() => {
      jest.advanceTimersByTime(60000);
    });
    expect(engine.requestSyncCycle).not.toHaveBeenCalled();

    act(() => {
      mockAppState.__setState('active');
    });
    act(() => {
      jest.advanceTimersByTime(30000);
    });
    expect(engine.requestSyncCycle).toHaveBeenCalledTimes(1);
  });

  it('não dispara em foreground se estiver offline', () => {
    const engine = makeSyncEngineStub();
    renderHook(() => useSyncTrigger(engine));

    act(() => {
      mockNetInfo.__setNetInfoState({ isConnected: false });
    });
    act(() => {
      jest.advanceTimersByTime(60000);
    });

    expect(engine.requestSyncCycle).not.toHaveBeenCalled();
  });
});
