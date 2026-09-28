import type { SFSymbol } from 'sf-symbols-typescript';

export interface EmptyStateProps {
  title: string;
  description?: string;
  /** iOS 專用：`ContentUnavailableView` 的 SF Symbol；其他平台忽略。 */
  systemImage?: SFSymbol;
}
