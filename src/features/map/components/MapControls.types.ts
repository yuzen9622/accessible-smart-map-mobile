import type { SFSymbol } from 'expo-symbols';

export interface MapControlAction {
  key: string;
  /** VoiceOver／TalkBack 朗讀與 Voice Control 點選用的名稱 */
  label: string;
  systemImage: SFSymbol;
  /** Android／fallback 沒有 SF Symbols 時顯示的短字 */
  shortLabel: string;
  onPress: () => void;
  /**
   * `primary`：這排按鈕裡「最重要的動作」用主色實心凸顯（像 Google 地圖的導航鈕），
   * 其餘維持玻璃感中性色——不然三顆長得一樣重，使用者得逐一讀 label 才知道哪顆是重點
   * （使用者回饋 2026-10-17：跟網頁版、Google 地圖比，浮動按鈕沒有視覺分層）。省略＝中性。
   */
  variant?: 'primary' | 'neutral';
}

export interface MapControlsProps {
  actions: MapControlAction[];
}
