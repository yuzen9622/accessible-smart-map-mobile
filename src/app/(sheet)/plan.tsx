import { beginNavigation } from '@/features/navigation';
import { RoutePlanScreen } from '@/features/route';
import { useAppTranslation } from '@/shared/i18n';

/** 路線卡；「開始導航」接 navigation feature（route 不 import navigation，在這裡組裝）。 */
export default function PlanSheet() {
  const { t } = useAppTranslation();
  return (
    <RoutePlanScreen
      onStartNavigation={() =>
        beginNavigation({ notificationTitle: t('nativeNavNotificationTitle'), notificationBody: t('nativeNavNotificationBody') })
      }
    />
  );
}
