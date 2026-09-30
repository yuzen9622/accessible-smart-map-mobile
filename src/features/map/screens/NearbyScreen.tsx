import { Stack, useLocalSearchParams } from 'expo-router';

import { useAppTranslation } from '@/shared/i18n';
import { getLocationPort } from '@/shared/location';

import NearbyPanel from '../components/NearbyPanel';
import { useNearbyParking } from '../hooks/useNearbyParking';
import { isNearbyFilter, useNearbyViewModel } from '../hooks/useNearbyViewModel';
import { useUserLocationStore } from '../store/userLocationStore';

/** 附近無障礙設施清單：地圖內容的無障礙替代路徑（SDD §10）。地圖圖層開關在首頁的圖層 chips。 */
export default function NearbyScreen() {
  const { t } = useAppTranslation();
  // `/nearby?category=elevator`：從「附近有 3 部電梯」這類入口直接開到該類別
  const { category } = useLocalSearchParams<{ category?: string }>();
  const model = useNearbyViewModel(isNearbyFilter(category) ? category : 'all');
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
          filterLabel: t('nativeFacilityFilterLabel'),
          empty: t('noNearbyA11y'),
          noLocation: t('noLocation'),
          locate: t('shortcutMyLocation'),
          loading: t('loading'),
        }}
      />
    </>
  );
}
