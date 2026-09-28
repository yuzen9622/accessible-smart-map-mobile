import { Stack } from 'expo-router';

import { SavedPlacesPanel } from '@/features/place';
import { useAppTranslation } from '@/shared/i18n';

export default function SavedPlacesRoute() {
  const { t } = useAppTranslation();
  return (
    <>
      <Stack.Screen options={{ title: t('savedPlaces') }} />
      <SavedPlacesPanel />
    </>
  );
}
