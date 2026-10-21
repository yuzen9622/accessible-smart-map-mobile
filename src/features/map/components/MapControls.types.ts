import type { SFSymbol } from 'expo-symbols';

export interface MapControlAction {
  key: string;
  /** VoiceOver／TalkBack 朗讀與 Voice Control 點選用的名稱 */
  label: string;
  systemImage: SFSymbol;
  /** Android／fallback 沒有 SF Symbols 時顯示的短字 */
  shortLabel: string;
  onPress: () => void;
}

export interface MapControlsProps {
  actions: MapControlAction[];
}
