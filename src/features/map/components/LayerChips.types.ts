export interface LayerChip {
  key: string;
  label: string;
  selected: boolean;
  onToggle: () => void;
}

export interface LayerChipsProps {
  chips: LayerChip[];
  /** VoiceOver 朗讀的群組名稱 */
  label: string;
}
