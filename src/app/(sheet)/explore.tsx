import { Stack } from 'expo-router';

import { ExplorePanel } from '@/features/place';
import { useAppTranslation } from '@/shared/i18n';

export default function ExploreSheet() {
  const { t } = useAppTranslation();
  // 標題不顯示，但會成為下一頁返回鍵的文字（否則是路由名稱 "explore"）
  return (
    <>
      <Stack.Screen options={{ headerShown: false, title: t('title') }} />
      <ExplorePanel />
    </>
  );
}
