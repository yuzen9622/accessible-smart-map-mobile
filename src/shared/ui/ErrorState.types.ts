import type { SFSymbol } from 'sf-symbols-typescript';

export interface ErrorStateRetryAction {
  label: string;
  onPress: () => void;
}

export interface ErrorStateProps {
  title: string;
  description?: string;
  /** iOS 專用：`ContentUnavailableView` 的 SF Symbol；其他平台忽略。 */
  systemImage?: SFSymbol;
  retry?: ErrorStateRetryAction;
}
