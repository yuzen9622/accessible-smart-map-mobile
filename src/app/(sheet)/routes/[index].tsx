import { RouteExplanationCard } from '@/features/ai';
import { BusLegStops } from '@/features/bus';
import { beginNavigation } from '@/features/navigation';
import { RouteDetailScreen } from '@/features/route';
import { useAppTranslation } from '@/shared/i18n';

/** 路線明細；公車 leg 的站點 ETA、「開始導航」與 AI 路線分析由其他 feature 注入。 */
export default function RouteDetailSheet() {
  const { t } = useAppTranslation();
  return (
    <RouteDetailScreen
      onStartNavigation={() =>
        beginNavigation({ notificationTitle: t('nativeNavNotificationTitle'), notificationBody: t('nativeNavNotificationBody') })
      }
      renderBusLeg={(args) => <BusLegStops {...args} />}
      renderExplanation={(route) => <RouteExplanationCard key={route.routeName} route={route} />}
    />
  );
}
