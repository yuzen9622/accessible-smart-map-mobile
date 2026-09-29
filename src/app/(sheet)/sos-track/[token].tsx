import { Stack, useLocalSearchParams } from 'expo-router';

import { SosTrackerScreen } from '@/features/sos';
import { useAppTranslation } from '@/shared/i18n';

/** 家人端追蹤：`accessiblesmartmap://sos-track/<shareToken>`。 */
export default function SosTrackSheet() {
  const { t } = useAppTranslation();
  const { token } = useLocalSearchParams<{ token: string }>();
  return (
    <>
      <Stack.Screen options={{ title: t('sosTrackingTitle') }} />
      <SosTrackerScreen token={token} />
    </>
  );
}
