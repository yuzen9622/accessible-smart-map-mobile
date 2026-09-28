import { Stack } from 'expo-router';

import { useAppTranslation } from '@/shared/i18n';

import OnboardingPanel from '../components/OnboardingPanel';
import { useOnboardingFlow } from '../hooks/useOnboardingFlow';

/**
 * Onboarding lite（Phase 1.4）：4 步驟（intro／needs／location／done）建立
 * 無障礙需求輪廓，並在完成時預先套用地圖設施篩選。以全螢幕 modal 呈現於地圖之上
 * （呼叫端決定 `presentation`，見 `src/app/onboarding.tsx`）。
 */
export default function OnboardingScreen() {
  const { t } = useAppTranslation();
  const model = useOnboardingFlow();

  return (
    <>
      <Stack.Screen options={{ title: t('onboarding.ariaTitle'), headerShown: false }} />
      <OnboardingPanel model={model} backLabel={t('onboarding.back')} skipLabel={t('onboarding.skip')} />
    </>
  );
}
