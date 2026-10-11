import { Stack } from 'expo-router';

import { TrainSearchScreen } from '@/features/train';
import { useAppTranslation } from '@/shared/i18n';
import { HeaderCloseButton } from '@/shared/ui';

/** 火車／高鐵時刻查詢（root modal）。 */
export default function TrainRoute() {
  const { t } = useAppTranslation();
  return (
    <>
      <Stack.Screen options={{ title: t('nativeTrainSearchTitle'), headerLeft: () => <HeaderCloseButton /> }} />
      <TrainSearchScreen />
    </>
  );
}
