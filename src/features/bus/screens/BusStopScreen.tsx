import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect } from 'react';
import { ScrollView, StyleSheet, Text, useColorScheme, View } from 'react-native';

import { mapCamera } from '@/features/map';
import { useAppTranslation } from '@/shared/i18n';
import { useThemeColors } from '@/shared/theme';
import { Icon } from '@/shared/ui';

import BusRow from '../components/BusRow';
import { BUS_ACCENT_COLOR, BUS_ACCENT_COLOR_DARK } from '../components/palette';
import { busCityLabel, firstParam, parseFiniteParam, parseRouteListParam } from '../domain';
import { useBusPanelStore } from '../store/busPanelStore';

const STOP_ZOOM = 17;
const STOP_ID = 'focused-stop';

/** 站牌詳情：站名、城市、行經路線；開啟時把地圖飛到該站。 */
export default function BusStopScreen() {
  const { t } = useAppTranslation();
  const colors = useThemeColors();
  const isDark = useColorScheme() === 'dark';
  const router = useRouter();
  const params = useLocalSearchParams<{ stopName?: string; city?: string; lat?: string; lng?: string; routes?: string }>();
  const stopName = firstParam(params.stopName);
  const city = firstParam(params.city);
  const lat = parseFiniteParam(params.lat);
  const lng = parseFiniteParam(params.lng);
  const routes = parseRouteListParam(params.routes);
  const cityText = busCityLabel(city);

  const setDisplayedStops = useBusPanelStore((s) => s.setDisplayedStops);
  const selectStop = useBusPanelStore((s) => s.selectStop);
  const clearPanel = useBusPanelStore((s) => s.clear);

  useFocusEffect(
    useCallback(() => {
      if (lat === null || lng === null) return;
      setDisplayedStops([{ id: STOP_ID, name: stopName, lat, lng }]);
      selectStop(STOP_ID);
      mapCamera.flyTo([lng, lat], STOP_ZOOM);
      return clearPanel;
    }, [lat, lng, stopName, setDisplayedStops, selectStop, clearPanel]),
  );
  useEffect(() => clearPanel, [clearPanel]);

  const accent = isDark ? BUS_ACCENT_COLOR_DARK : BUS_ACCENT_COLOR;

  return (
    <>
      <Stack.Screen options={{ title: stopName }} />
      <ScrollView
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic">
        <View style={styles.header}>
          <View style={styles.eyebrow}>
            <Icon name="mapPin" size={14} color={accent} />
            <Text style={[styles.eyebrowText, { color: accent }]}>{cityText}</Text>
          </View>
          <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
            {stopName}
          </Text>
        </View>
        <Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.textSecondary }]}>
          {t('nativeBusRoutesAtStop')}
        </Text>
        {routes.length === 0 ? (
          <Text style={[styles.empty, { color: colors.textSecondary }]}>{t('noBusData')}</Text>
        ) : (
          <View style={styles.list}>
            {routes.map((routeName) => (
              <BusRow
                key={routeName}
                icon="bus"
                title={routeName}
                showChevron
                accessibilityLabel={t('nativeBusStopRouteRowLabel', { route: routeName, stop: stopName })}
                onPress={() => router.push({ pathname: '/bus/route', params: { routeName, city } })}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 12 },
  header: { gap: 4 },
  eyebrow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  eyebrowText: { fontSize: 13, fontWeight: '600' },
  title: { fontSize: 28, fontWeight: '700' },
  sectionTitle: { fontSize: 13, fontWeight: '600' },
  list: { gap: 8 },
  empty: { fontSize: 15 },
});
