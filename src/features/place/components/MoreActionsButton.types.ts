export interface MoreAction {
  label: string;
  onPress: () => void;
}

export interface MoreActionsButtonProps {
  /** 按鈕本身的 VoiceOver 名稱，也是選單標題 */
  label: string;
  cancelLabel: string;
  actions: MoreAction[];
  backgroundColor: string;
  color: string;
}
