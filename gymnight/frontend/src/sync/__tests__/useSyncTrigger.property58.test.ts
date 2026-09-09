/**
 * Property 58: useSyncTrigger — debounce de 2s. N transições offline→online
 * em menos de 2s resultam num ciclo só (Wave 4.5 §1.4.1).
 */
import { renderHook, act } from '@testing-library/react-native';
import NetInfo from '@react-native-community/netinfo';
import { useSyncTrigger } from '../useSyncTrigger';
import type { SyncEngine } from '../SyncEngine';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockNetInfo = NetInfo as any;

function makeSyncEngineStub() {
  const requestSyncCycle = jest.fn().mockResolvedValue(undefined);
  return { requestSyncCycle } as unknown as SyncEngine;
}

function flap(mock: typeof mockNetInfo) {
  act(() => {
    mock.__setNetInfoState({ isConnected: false });
  });
  act(() => {
    mock.__setNetInfoState({ isConnected: true });
  });
}

describe('Property 58: useSyncTrigger — debounce de 2s coalesce N transições num ciclo só', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockNetInfo.__reset();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('3 transições offline→online em 500ms cada resultam em um único ciclo', () => {
    const engine = makeSyncEngineStub();
    renderHook(() => useSyncTrigger(engine));

    flap(mockNetInfo);
    act(() => {
      jest.advanceTimersByTime(500);
    });
    flap(mockNetInfo);
    act(() => {
      jest.advanceTimersByTime(500);
    });
    flap(mockNetInfo);

    // Menos de 2s desde a última transição — ainda não deve ter disparado.
    act(() => {
      jest.advanceTimersByTime(1999);
    });
    expect(engine.requestSyncCycle).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(engine.requestSyncCycle).toHaveBeenCalledTimes(1);
  });

  it('duas rajadas separadas por mais de 2s resultam em dois ciclos', () => {
    const engine = makeSyncEngineStub();
    renderHook(() => useSyncTrigger(engine));

    flap(mockNetInfo);
    act(() => {
      jest.advanceTimersByTime(2000);
    });
    expect(engine.requestSyncCycle).toHaveBeenCalledTimes(1);

    flap(mockNetInfo);
    act(() => {
      jest.advanceTimersByTime(2000);
    });
    expect(engine.requestSyncCycle).toHaveBeenCalledTimes(2);
  });
});
