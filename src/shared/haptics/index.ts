import * as Haptics from 'expo-haptics';

/** 語意化觸覺：各 feature 不直接呼叫 `expo-haptics`。一個使用者動作最多一次。 */
export const haptic = {
  select: () => void Haptics.selectionAsync(),
  commit: () => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
  success: () => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  warning: () => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
  error: () => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
  sos: (secondsLeft: number) =>
    void Haptics.impactAsync(
      secondsLeft <= 2 ? Haptics.ImpactFeedbackStyle.Heavy : Haptics.ImpactFeedbackStyle.Light,
    ),
} as const;
