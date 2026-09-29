import { Stack, useLocalSearchParams } from 'expo-router';

import RoutePlanPanel from '../components/RoutePlanPanel';
import { useRoutePlanViewModel, type RoutePlanParams } from '../hooks/useRoutePlanViewModel';

/** `(sheet)/plan` — 路線規劃表單。地點詳情「規劃路線」以 `destLat`／`destLng`／`destName` 帶入目的地。 */
export default function RoutePlanScreen() {
  const params = useLocalSearchParams<{ destLat?: string; destLng?: string; destName?: string }>();
  const planParams: RoutePlanParams = { destLat: params.destLat, destLng: params.destLng, destName: params.destName };
  const model = useRoutePlanViewModel(planParams);
  return (
    <>
      <Stack.Screen options={{ title: model.labels.title }} />
      <RoutePlanPanel model={model} />
    </>
  );
}
