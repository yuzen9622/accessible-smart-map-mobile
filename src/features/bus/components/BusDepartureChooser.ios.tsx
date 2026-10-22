import * as Haptics from 'expo-haptics';

import BusDepartureChooserBase from './BusDepartureChooserBase';
import type { BusDepartureChooserProps } from './BusDepartureChooser.types';

async function feedback(): Promise<void> {
  try {
    await Haptics.selectionAsync();
  } catch {
    // 觸覺回饋失敗（裝置不支援、省電模式）不影響換班次
  }
}

/** iOS：換班次給 selection 觸覺回饋（同系統 picker 撥動的手感），按下時卡片微縮。 */
export default function BusDepartureChooser(props: BusDepartureChooserProps) {
  return <BusDepartureChooserBase {...props} variant="ios" onFeedback={() => void feedback()} />;
}
