export interface MapLayersMenuToggle {
  key: string;
  label: string;
  selected: boolean;
  onToggle: () => void;
}

export interface MapLayersMenuProps {
  /** 卡片距螢幕頂端的絕對位置（呼叫端依「定位＋圖層」按鈕欄的實際高度算好傳入）。 */
  anchorTop: number;
  /** 選單標題上方的「3D 建築」開關；跟設施分類分開一排，語意不同（視角 vs. 疊圖）。 */
  is3d: boolean;
  onToggle3d: () => void;
  /** 電梯／坡道／廁所／停車 */
  facilityToggles: MapLayersMenuToggle[];
  onClose: () => void;
}
