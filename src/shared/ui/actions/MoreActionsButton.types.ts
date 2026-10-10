export interface MoreAction {
  label: string;
  onPress: () => void;
}

export interface MoreActionsButtonProps {
  /** 按鈕的無障礙名稱 */
  label: string;
  /** 非原生平台 Modal fallback 的取消按鈕名稱 */
  cancelLabel: string;
  actions: MoreAction[];
  backgroundColor: string;
  color: string;
}
