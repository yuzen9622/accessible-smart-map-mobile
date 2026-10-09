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
  /** 展開狀態；收起時只顯示篩選切換鈕，不渲染個別分類 chips（平常不佔地圖版面，設計 1c）。 */
  expanded: boolean;
  /** 切換鈕的 VoiceOver 文案，依 expanded 狀態由呼叫端決定（已展開／已收起兩種文案）。 */
  toggleLabel: string;
  onToggleExpanded: () => void;
}
