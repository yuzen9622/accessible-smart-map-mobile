import * as Haptics from 'expo-haptics';

import BusDepartureChooserBase from './BusDepartureChooserBase';
import type { BusDepartureChooserProps } from './BusDepartureChooser.types';

async function feedback(): Promise<void> {
  try {
    await Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Segment_Tick);
  } catch {
    // 觸覺回饋失敗（裝置不支援、省電模式）不影響換班次
  }
}

/** Android：Material 水波紋＋segment tick 觸覺回饋。 */
export default function BusDepartureChooser(props: BusDepartureChooserProps) {
  return (
    <BusDepartureChooserBase
      {...props}
      variant="material"
      onFeedback={() => void feedback()}
    />
  );
}
