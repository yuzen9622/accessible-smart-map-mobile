import { RouteExplanationCard } from '@/features/ai';
import { BusLegStops } from '@/features/bus';
import { beginNavigation } from '@/features/navigation';
import { previewLegGeometry, RouteDetailScreen } from '@/features/route';
import { useAppTranslation } from '@/shared/i18n';

/** 路線明細；公車 leg 的站點 ETA（查看別班時地圖改畫那班的線形）、「開始導航」與 AI 路線分析由其他 feature 注入。 */
export default function RouteDetailSheet() {
  const { t } = useAppTranslation();
  return (
    <RouteDetailScreen
      onStartNavigation={() =>
        beginNavigation({ notificationTitle: t('nativeNavNotificationTitle'), notificationBody: t('nativeNavNotificationBody') })
      }
      renderBusLeg={(args) => (
        <BusLegStops
          {...args}
          onPreviewGeometry={(polyline) =>
            previewLegGeometry(polyline ? { routeId: args.route.routeId, legIndex: args.legIndex, polyline } : null)
          }
        />
      )}
      renderExplanation={(route) => <RouteExplanationCard key={route.routeName} route={route} />}
    />
  );
}
