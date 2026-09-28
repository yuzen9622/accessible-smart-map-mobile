import type { OnboardingViewModel } from '../hooks/useOnboardingFlow';

export interface OnboardingPanelProps {
  model: OnboardingViewModel;
  /** 「上一步」按鈕的無障礙標籤（既有翻譯 `onboarding.back`）。 */
  backLabel: string;
  /** 「略過」按鈕的無障礙標籤（既有翻譯 `onboarding.skip`）。 */
  skipLabel: string;
}
