import { Stack, router } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { useAppTranslation } from '@/shared/i18n';
import { useThemeColors } from '@/shared/theme';
import { EmptyState, Icon } from '@/shared/ui';

import RouteCard from '../components/RouteCard';
import { ROUTE_ON_ACCENT_COLOR, routeStyles } from '../components/palette';
import { selectRouteAt } from '../controller/routeSessionPort';
import { useRouteSessionStore } from '../store/routeSessionStore';

export interface RouteListScreenProps {
  /** 由 app 路由組裝注入 navigation feature 的開始導航（route 不 import navigation，避免循環）。 */
  onStartNavigation: () => void;
}

/**
 * `(sheet)/routes` — 路線比較清單（Web `RouteContent.tsx`）。依後端順序列出，預設選中第一條；
 * 點卡片換選中路線並框到它，「路線詳情」進入 leg 明細，頂端「開始導航」。
 * 返回（原生返回鍵）回到規劃表單，起訖點保留；Web 返回會清掉結果，這裡保留結果讓 pill 與地圖一致，
 * 下一次按「開始規劃」會整組替換。
 */
export default function RouteListScreen({ onStartNavigation }: RouteListScreenProps) {
  const { t } = useAppTranslation();
  const colors = useThemeColors();
  const routes = useRouteSessionStore((s) => s.computeRoutes);
  const selected = useRouteSessionStore((s) => s.selectRoute);

  return (
    <>
      <Stack.Screen options={{ title: t('routeResultsTitle') }} />
      {!routes || routes.length === 0 ? (
        <EmptyState title={t('nativeRouteErrorEmpty')} systemImage="map" />
      ) : (
        <ScrollView
          style={{ backgroundColor: colors.background }}
          contentContainerStyle={routeStyles.content}
          contentInsetAdjustmentBehavior="automatic">
          {selected ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('startNav')}
              onPress={onStartNavigation}
              style={routeStyles.primaryButton}>
              <Icon name="navigation" color={ROUTE_ON_ACCENT_COLOR} />
              <Text style={routeStyles.primaryButtonText}>{t('startNav')}</Text>
            </Pressable>
          ) : null}
          <View style={routeStyles.section}>
            {routes.map((route, index) => (
              <RouteCard
                key={route.routeId || String(index)}
                route={route}
                selected={selected?.index === index}
                onSelect={() => selectRouteAt(index)}
                onOpenDetail={() => {
                  selectRouteAt(index);
                  router.push({ pathname: '/routes/[index]', params: { index: String(index) } });
                }}
              />
            ))}
          </View>
        </ScrollView>
      )}
    </>
  );
}
