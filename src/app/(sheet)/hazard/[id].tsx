import { Stack, useLocalSearchParams } from 'expo-router';

import { HazardDetailScreen } from '@/features/hazard';
import { useAppTranslation } from '@/shared/i18n';

export default function HazardDetailSheet() {
  const { t } = useAppTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <>
      <Stack.Screen options={{ title: t('hazardReport') }} />
      <HazardDetailScreen id={id} />
    </>
  );
}
