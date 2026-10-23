import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

async function run(effect: () => Promise<void>): Promise<void> {
  try {
    await effect();
  } catch {
    // 觸覺失敗（裝置不支援、省電模式）不影響操作。
  }
}

/** 語意化觸覺：各 feature 不直接呼叫 `expo-haptics`。一個使用者動作最多一次。 */
export const haptic = {
  select: () =>
    void run(() =>
      Platform.OS === 'android'
        ? Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Segment_Tick)
        : Haptics.selectionAsync(),
    ),
  commit: () => void run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  /** 換導航步驟、觸發緊急流程這類需要被注意到的瞬間。 */
  emphasis: () => void run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  success: () => void run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  warning: () => void run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
  error: () => void run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
  sos: (secondsLeft: number) =>
    void run(() =>
      Haptics.impactAsync(secondsLeft <= 2 ? Haptics.ImpactFeedbackStyle.Heavy : Haptics.ImpactFeedbackStyle.Light),
    ),
} as const;
