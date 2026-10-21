import { Stack } from 'expo-router';

import { EnvironmentDetailScreen } from '@/features/map';
import { useAppTranslation } from '@/shared/i18n';
import { HeaderCloseButton } from '@/shared/ui';

/** 天氣／空氣品質詳情（root modal，由地圖左上角的 `EnvironmentChip` 開啟）。 */
export default function EnvironmentRoute() {
  const { t } = useAppTranslation();
  return (
    <>
      <Stack.Screen options={{ title: t('nativeEnvironmentChipTitle'), headerLeft: () => <HeaderCloseButton /> }} />
      <EnvironmentDetailScreen />
    </>
  );
}
