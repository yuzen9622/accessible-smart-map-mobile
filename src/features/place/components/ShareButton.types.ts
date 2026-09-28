export interface ShareButtonProps {
  url: string;
  title: string;
  label: string;
  /** RN `Share`（Android／fallback）；iOS 走 `ShareLink`，不使用 */
  onShare: () => void;
}
