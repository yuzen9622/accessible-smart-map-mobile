import { Stack } from 'expo-router';

import { ExplorePanel } from '@/features/place';
import { useAppTranslation } from '@/shared/i18n';

export default function ExploreSheet() {
  const { t } = useAppTranslation();
  return (
    <>
      <Stack.Screen options={{ title: t('title'), headerShown: false }} />
      <ExplorePanel />
    </>
  );
}
