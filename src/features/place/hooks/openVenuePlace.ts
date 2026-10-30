import { router } from 'expo-router';
import { Keyboard } from 'react-native';

import { sheetNavigation } from '@/features/map';

import { venuePlaceId, type VenuePlaceIdentity } from '../domain/venuePlace';

/** 地圖房間與主搜尋共用原本的地點詳情路由。 */
export function openVenuePlace(identity: VenuePlaceIdentity): void {
  Keyboard.dismiss();
  sheetNavigation.whenVisible(() => router.navigate({ pathname: '/place/[id]', params: { id: venuePlaceId(identity) } }));
}
