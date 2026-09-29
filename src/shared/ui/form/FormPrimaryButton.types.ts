export interface FormPrimaryButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  /** 送出中：膠囊保持原位與大小，裡面換成轉圈並停用（不要整列換成 ProgressView，版面會跳）。 */
  loading?: boolean;
  /** 送出中給 VoiceOver 的提示；預設為「處理中」。 */
  loadingHint?: string;
  /** `destructive`：紅色實心（登出、刪除、結束）。 */
  tone?: 'accent' | 'destructive';
}

export interface FormSecondaryButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}
