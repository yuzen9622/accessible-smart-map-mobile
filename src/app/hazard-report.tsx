import { Stack, useLocalSearchParams } from 'expo-router';

import { HazardReportScreen } from '@/features/hazard';
import { useAppTranslation } from '@/shared/i18n';
import { HeaderCloseButton } from '@/shared/ui';

function toNumber(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

/** 危險通報（root modal）。可帶 `lat`／`lng`／`description`（從地點詳情「回報此處」）。 */
export default function HazardReportRoute() {
  const { t } = useAppTranslation();
  const params = useLocalSearchParams<{ lat?: string; lng?: string; description?: string }>();
  return (
    <>
      <Stack.Screen options={{ title: t('hazardReport'), headerLeft: () => <HeaderCloseButton /> }} />
      <HazardReportScreen lat={toNumber(params.lat)} lng={toNumber(params.lng)} description={params.description} />
    </>
  );
}
