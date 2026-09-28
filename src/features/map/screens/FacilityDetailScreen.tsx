import { Stack, useLocalSearchParams } from 'expo-router';

import { useAppTranslation } from '@/shared/i18n';
import { EmptyState, LoadingState } from '@/shared/ui';

import FacilityDetailPanel from '../components/FacilityDetailPanel';
import { useFacilityDetail } from '../hooks/useFacilityDetail';

export default function FacilityDetailScreen() {
  const { t } = useAppTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const model = useFacilityDetail(typeof id === 'string' ? id : '');

  return (
    <>
      <Stack.Screen options={{ title: t('accessibleTitle') }} />
      {model.status === 'loading' ? <LoadingState label={t('loading')} /> : null}
      {model.status === 'not-found' ? (
        <EmptyState title={t('nativeFacilityNotFound')} systemImage="mappin.slash" />
      ) : null}
      {model.status === 'ready' ? (
        <FacilityDetailPanel
          title={model.title}
          rows={model.rows}
          showOnMapLabel={t('nativeShowOnMap')}
          onShowOnMap={model.onShowOnMap}
        />
      ) : null}
    </>
  );
}
