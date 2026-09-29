import { Stack } from 'expo-router';

import { ReviewFormScreen } from '@/features/place';
import { useAppTranslation } from '@/shared/i18n';
import { HeaderCloseButton } from '@/shared/ui';

export default function ReviewRoute() {
  const { t } = useAppTranslation();
  return (
    <>
      <Stack.Screen options={{ title: t('writeReview'), headerLeft: () => <HeaderCloseButton /> }} />
      <ReviewFormScreen />
    </>
  );
}
