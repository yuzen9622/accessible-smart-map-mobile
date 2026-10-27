import { isLiquidGlassAvailable } from 'expo-glass-effect';
import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

import { usePreferencesStore } from '@/shared/preferences/preferencesStore';

/** UIKit 與 SwiftUI 玻璃共用相同的可用性與輔助使用設定。 */
export function useLiquidGlass(): boolean {
  const highContrast = usePreferencesStore(s => s.highContrast);
  const [reduceTransparency, setReduceTransparency] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const enabled = await AccessibilityInfo.isReduceTransparencyEnabled();
        if (active) setReduceTransparency(enabled);
      } catch {
        // 讀不到就維持玻璃效果
      }
    };
    void load();
    const subscription = AccessibilityInfo.addEventListener('reduceTransparencyChanged', setReduceTransparency);
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  return !highContrast && isLiquidGlassAvailable() && !reduceTransparency;
}
