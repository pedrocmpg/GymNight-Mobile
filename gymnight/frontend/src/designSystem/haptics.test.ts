/**
 * haptics + motion — mapeamento de intenção → API do expo-haptics, falhas
 * engolidas, e o LayoutAnimation respeitando "Reduzir movimento".
 */
import * as Haptics from 'expo-haptics';
import { LayoutAnimation } from 'react-native';
import { haptic } from './haptics';
import { animateLayout } from './motion';

describe('haptic()', () => {
  beforeEach(() => {
    (Haptics.selectionAsync as jest.Mock).mockClear();
    (Haptics.impactAsync as jest.Mock).mockClear();
    (Haptics.notificationAsync as jest.Mock).mockClear();
  });

  it.each([
    ['light', Haptics.impactAsync, Haptics.ImpactFeedbackStyle.Light],
    ['medium', Haptics.impactAsync, Haptics.ImpactFeedbackStyle.Medium],
    ['success', Haptics.notificationAsync, Haptics.NotificationFeedbackType.Success],
    ['warning', Haptics.notificationAsync, Haptics.NotificationFeedbackType.Warning],
  ] as const)('maps %s to the matching expo-haptics call', (kind, fn, arg) => {
    haptic(kind);
    expect(fn).toHaveBeenCalledWith(arg);
  });

  it('maps selection to selectionAsync', () => {
    haptic('selection');
    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1);
  });

  it('swallows a rejected haptic — feedback never breaks a flow', async () => {
    (Haptics.selectionAsync as jest.Mock).mockRejectedValueOnce(new Error('no vibrator'));
    expect(() => haptic('selection')).not.toThrow();
    await Promise.resolve();
  });

  it('swallows a synchronous throw from a missing native module', () => {
    (Haptics.selectionAsync as jest.Mock).mockImplementationOnce(() => {
      throw new Error('native module missing');
    });
    expect(() => haptic('selection')).not.toThrow();
  });
});

describe('animateLayout()', () => {
  it('configures the next layout animation', () => {
    (LayoutAnimation.configureNext as jest.Mock).mockClear();
    animateLayout();
    expect(LayoutAnimation.configureNext).toHaveBeenCalledTimes(1);
  });
});
