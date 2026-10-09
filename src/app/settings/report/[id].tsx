import { useLocalSearchParams } from 'expo-router';

import { MyReportDetailScreen } from '@/features/hazard';

/** 設定 → 我的回報 → 單筆回報詳情。 */
export default function MyReportDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <MyReportDetailScreen id={id} />;
}
