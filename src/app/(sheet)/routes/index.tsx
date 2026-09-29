import { beginNavigation } from '@/features/navigation';
import { RouteListScreen } from '@/features/route';
import { useAppTranslation } from '@/shared/i18n';

/** 路線清單；「開始導航」接 navigation feature（route 不 import navigation，在這裡組裝）。 */
export default function RoutesSheet() {
  const { t } = useAppTranslation();
  return (
    <RouteListScreen
      onStartNavigation={() =>
        beginNavigation({ notificationTitle: t('nativeNavNotificationTitle'), notificationBody: t('nativeNavNotificationBody') })
      }
    />
  );
}
