import { makeMutable, type SharedValue } from 'react-native-reanimated';

import type { WaveformLevelSource } from '../domain/audioLevel';

/**
 * 麥克風與助理播放的即時音量 [0, 1]。刻意不放 zustand：麥克風每 100ms、播放每 33ms 更新一次，
 * 放在 store 會讓語音畫面跟著每秒重繪數十次、塞住 JS thread。改成 Reanimated SharedValue，
 * 音波在 UI thread 直接讀，React 完全不參與。寫入只經過 `controller/voiceController.ts`。
 */
export const voiceLevels: { mic: SharedValue<number>; model: SharedValue<number> } = {
  mic: makeMutable(0),
  model: makeMutable(0),
};

export function voiceLevelFor(source: WaveformLevelSource): SharedValue<number> | null {
  if (source === 'mic') return voiceLevels.mic;
  if (source === 'model') return voiceLevels.model;
  return null;
}
