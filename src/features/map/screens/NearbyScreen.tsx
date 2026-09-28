import { Stack } from 'expo-router';

import { useAppTranslation } from '@/shared/i18n';
import { getLocationPort } from '@/shared/location';

import NearbyPanel from '../components/NearbyPanel';
import { useNearbyParking } from '../hooks/useNearbyParking';
import { useNearbyViewModel } from '../hooks/useNearbyViewModel';
import { useUserLocationStore } from '../store/userLocationStore';

/** 附近無障礙設施清單：地圖內容的無障礙替代路徑（SDD §10），也是設施類別開關的位置。 */
export default function NearbyScreen() {
  const { t } = useAppTranslation();
  const model = useNearbyViewModel();
  const setPermission = useUserLocationStore((state) => state.setPermission);
  useNearbyParking();

  const requestLocation = async () => {
    try {
      setPermission(await getLocationPort().requestForegroundPermission());
    } catch (error) {
      console.warn('[nearby] permission request failed', error);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: t('nearbyA11y') }} />
      <NearbyPanel
        model={model}
        onRequestLocation={() => void requestLocation()}
        labels={{
          filterHint: t('a11yFilterHint'),
          nearbyTitle: t('nearbyA11y'),
          empty: t('noNearbyA11y'),
          noLocation: t('noLocation'),
          locate: t('shortcutMyLocation'),
          loading: t('loading'),
        }}
      />
    </>
  );
}
