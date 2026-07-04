/**
 * Mock do @react-native-community/netinfo para testes.
 * Permite simular transições de conectividade sem rede real.
 */

type NetInfoState = {
  isConnected: boolean;
  isInternetReachable: boolean | null;
  type: string;
};

type Listener = (state: NetInfoState) => void;

let currentState: NetInfoState = {
  isConnected: true,
  isInternetReachable: true,
  type: 'wifi',
};

const listeners: Set<Listener> = new Set();

const NetInfo = {
  fetch: (): Promise<NetInfoState> => Promise.resolve(currentState),

  addEventListener: (listener: Listener) => {
    listeners.add(listener);
    // Emit current state immediately (matches real behavior)
    listener(currentState);
    return () => {
      listeners.delete(listener);
    };
  },

  /** Test helper: simulate connectivity change */
  __setNetInfoState: (state: Partial<NetInfoState>) => {
    currentState = { ...currentState, ...state };
    listeners.forEach((l) => l(currentState));
  },

  /** Test helper: reset to default */
  __reset: () => {
    currentState = { isConnected: true, isInternetReachable: true, type: 'wifi' };
    listeners.clear();
  },
};

export default NetInfo;
