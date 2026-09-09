/**
 * Property 57: useSyncTrigger dispara requestSyncCycle EXATAMENTE uma vez na
 * transição offline→online, não a cada emissão do NetInfo (Wave 4.5 §1.4).
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

describe('Property 57: useSyncTrigger — dispara uma vez na transição offline→online', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockNetInfo.__reset();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('não dispara ao montar já online (não é uma transição)', () => {
    const engine = makeSyncEngineStub();
    renderHook(() => useSyncTrigger(engine));

    act(() => {
      jest.advanceTimersByTime(5000);
    });

    expect(engine.requestSyncCycle).not.toHaveBeenCalled();
  });

  it('dispara exatamente um ciclo na transição offline→online', () => {
    const engine = makeSyncEngineStub();
    renderHook(() => useSyncTrigger(engine));

    act(() => {
      mockNetInfo.__setNetInfoState({ isConnected: false });
    });
    act(() => {
      mockNetInfo.__setNetInfoState({ isConnected: true });
    });
    act(() => {
      jest.advanceTimersByTime(2000);
    });

    expect(engine.requestSyncCycle).toHaveBeenCalledTimes(1);
  });

  it('emissões repetidas de "online" (sem transição) não disparam de novo', () => {
    const engine = makeSyncEngineStub();
    renderHook(() => useSyncTrigger(engine));

    act(() => {
      mockNetInfo.__setNetInfoState({ isConnected: false });
    });
    act(() => {
      mockNetInfo.__setNetInfoState({ isConnected: true });
    });
    act(() => {
      jest.advanceTimersByTime(2000);
    });
    expect(engine.requestSyncCycle).toHaveBeenCalledTimes(1);

    // Mais emissões de "online" (sem passar por offline antes) — NetInfo real
    // pode reemitir o mesmo estado; não é uma transição.
    act(() => {
      mockNetInfo.__setNetInfoState({ isConnected: true });
    });
    act(() => {
      mockNetInfo.__setNetInfoState({ isConnected: true });
    });
    act(() => {
      jest.advanceTimersByTime(2000);
    });

    expect(engine.requestSyncCycle).toHaveBeenCalledTimes(1);
  });
});
