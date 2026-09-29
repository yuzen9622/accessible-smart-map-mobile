import { Stack, useLocalSearchParams } from 'expo-router';

import RoutePlanPanel from '../components/RoutePlanPanel';
import { useRoutePlanViewModel, type RoutePlanParams } from '../hooks/useRoutePlanViewModel';

export interface RoutePlanScreenProps {
  /** 由 app 路由組裝注入 navigation feature 的開始導航（route 不 import navigation，避免循環）。 */
  onStartNavigation: () => void;
}

/**
 * `(sheet)/plan` — 路線卡：起訖點、交通方式，與自動算出的路線選擇。
 * 地點詳情「規劃路線」以 `destLat`／`destLng`／`destName` 帶入目的地。
 */
export default function RoutePlanScreen({ onStartNavigation }: RoutePlanScreenProps) {
  const params = useLocalSearchParams<{ destLat?: string; destLng?: string; destName?: string }>();
  const planParams: RoutePlanParams = { destLat: params.destLat, destLng: params.destLng, destName: params.destName };
  const model = useRoutePlanViewModel(planParams);
  return (
    <>
      <Stack.Screen options={{ title: model.labels.title }} />
      <RoutePlanPanel model={model} onStartNavigation={onStartNavigation} />
    </>
  );
}
