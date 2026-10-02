import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, useColorScheme, View } from 'react-native';

import { SHEET_DETENTS, sheetController, useUserLocationStore } from '@/features/map';
import { formatDistance } from '@/shared/geo';
import { useAppTranslation } from '@/shared/i18n';
import { RADIUS, SPACE, TYPE, semanticColors, useThemeColors } from '@/shared/theme';
import { Icon, SegmentedControl } from '@/shared/ui';

import RouteBadge from '../components/RouteBadge';
import { groupByCity, type BusSearchResult, type BusStopSearchResult } from '../domain';
import { useBusSearch, type BusSearchError, type BusSearchMode } from '../hooks/useBusSearch';
import { useNearbyBusStops } from '../hooks/useNearbyBusStops';
import { useBusPanelStore, type PanelStop } from '../store/busPanelStore';

function toPanelStops(stops: BusStopSearchResult[]): PanelStop[] {
  return stops.map((s) => ({ id: s.stopUid || s.stopName, name: s.stopName, lat: s.coordinates[1], lng: s.coordinates[0] }));
}

/** 站牌列只露出前幾條路線，其餘收成「+N」——大站牌有近 40 條路線，全列出來會把一列撐成一整面。 */
const STOP_ROUTE_PREVIEW = 4;

/**
 * 公車面板：找路線／找站牌；沒輸入關鍵字時顯示附近站牌。
 * 版型與站牌（2b）、路線（2a）同一套：segmented 切換、膠囊搜尋框、透明底分隔線列表、路線號碼膠囊。
 */
export default function BusPanelScreen() {
  const { t } = useAppTranslation();
  const colors = useThemeColors();
  const isDark = useColorScheme() === 'dark';
  const router = useRouter();
  const position = useUserLocationStore((s) => s.position);
  const [mode, setMode] = useState<BusSearchMode>('route');
  const [keyword, setKeyword] = useState('');
  const trimmed = keyword.trim();
  const searching = trimmed.length > 0;

  const search = useBusSearch(keyword, mode, position);
  const nearby = useNearbyBusStops(position, !searching);
  const setDisplayedStops = useBusPanelStore((s) => s.setDisplayedStops);
  const clearPanel = useBusPanelStore((s) => s.clear);

  const searchStops = search.mode === 'stop' ? search.results : null;
  const nearbyStops = nearby.stops;

  useEffect(() => {
    const shown = searching ? (searchStops ?? []) : nearbyStops;
    setDisplayedStops(toPanelStops(shown));
  }, [searching, searchStops, nearbyStops, setDisplayedStops]);
  useEffect(() => clearPanel, [clearPanel]);

  const semantic = semanticColors(isDark);
  const errorText = (error: BusSearchError) => (error === 'NO_DATA' ? t('noBusData') : t('networkError'));

  const openStop = (stop: BusStopSearchResult) =>
    router.navigate({
      pathname: '/bus/stop',
      params: {
        stopName: stop.stopName,
        city: stop.city,
        lat: String(stop.coordinates[1]),
        lng: String(stop.coordinates[0]),
        routes: JSON.stringify(stop.routes),
      },
    });

  const separator = (index: number) =>
    index > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: semantic.separator } : null;

  const renderStopGroups = (stops: BusStopSearchResult[]) =>
    groupByCity(stops).map((group) => (
      <View key={group.city} style={styles.group}>
        <Text accessibilityRole="header" style={[styles.groupTitle, { color: colors.textSecondary }]}>
          {group.label}
        </Text>
        <View>
          {group.items.map((stop, index) => {
            const distance = stop.distance !== undefined ? formatDistance(stop.distance) : '';
            const preview = stop.routes.slice(0, STOP_ROUTE_PREVIEW);
            const more = stop.routes.length - preview.length;
            return (
              <Pressable
                key={`${stop.stopUid}-${stop.stopName}-${stop.coordinates.join(',')}`}
                accessibilityRole="button"
                accessibilityLabel={t('nativeBusStopRowLabel', {
                  name: stop.stopName,
                  city: group.label,
                  distance: distance || t('nativeBusDistanceUnknown'),
                  count: stop.routes.length,
                })}
                onPress={() => openStop(stop)}
                style={({ pressed }) => [styles.row, separator(index), pressed && styles.pressed]}>
                <View style={[styles.iconCircle, { backgroundColor: semantic.accentSoft }]}>
                  <Icon name="bus" size={18} color={semantic.accent} />
                </View>
                <View style={styles.rowTexts}>
                  <Text style={[styles.rowTitle, { color: colors.text }]} numberOfLines={2}>
                    {stop.stopName}
                  </Text>
                  {stop.routes.length > 0 ? (
                    <View style={styles.chips} importantForAccessibility="no-hide-descendants">
                      {preview.map((route) => (
                        <RouteBadge key={route} name={route} small />
                      ))}
                      {more > 0 ? (
                        <Text style={[styles.moreText, { color: colors.textSecondary }]}>{t('nativeBusMoreRoutes', { count: more })}</Text>
                      ) : null}
                    </View>
                  ) : null}
                </View>
                {distance ? <Text style={[styles.distance, { color: colors.textSecondary }]}>{distance}</Text> : null}
                <Icon name="chevronRight" size={16} color={colors.textSecondary} />
              </Pressable>
            );
          })}
        </View>
      </View>
    ));

  const renderRouteGroups = (routes: BusSearchResult[]) =>
    groupByCity(routes).map((group) => (
      <View key={group.city} style={styles.group}>
        <Text accessibilityRole="header" style={[styles.groupTitle, { color: colors.textSecondary }]}>
          {group.label}
        </Text>
        <View>
          {group.items.map((route, index) => (
            <Pressable
              key={`${route.city}-${route.routeName}-${route.departure}-${route.destination}`}
              accessibilityRole="button"
              accessibilityLabel={t('nativeBusRouteRowLabel', {
                route: route.routeName,
                departure: route.departure,
                destination: route.destination,
                city: group.label,
              })}
              onPress={() =>
                router.navigate({
                  pathname: '/bus/route',
                  params: { routeName: route.routeName, city: route.city, departure: route.departure, destination: route.destination },
                })
              }
              style={({ pressed }) => [styles.row, separator(index), pressed && styles.pressed]}>
              <RouteBadge name={route.routeName} />
              <View style={styles.rowTexts}>
                {route.departure || route.destination ? (
                  <Text style={[styles.rowTitle, { color: colors.text }]} numberOfLines={2}>
                    {`${route.departure} – ${route.destination}`}
                  </Text>
                ) : null}
              </View>
              <Icon name="chevronRight" size={16} color={colors.textSecondary} />
            </Pressable>
          ))}
        </View>
      </View>
    ));

  const renderBody = () => {
    if (!searching) {
      if (!position) return <Message text={t('nativeBusNearbyNoLocation')} color={colors.textSecondary} />;
      return (
        <View style={styles.section}>
          <Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.text }]}>
            {t('nativeBusNearbyStops')}
          </Text>
          {nearby.loading && nearby.stops.length === 0 ? (
            <Loading label={t('loading')} color={colors.textSecondary} />
          ) : nearby.error && nearby.stops.length === 0 ? (
            <Message text={errorText(nearby.error)} color={colors.textSecondary} />
          ) : nearby.stops.length === 0 ? (
            <Message text={t('nativeNoSearchResults')} color={colors.textSecondary} />
          ) : (
            renderStopGroups(nearby.stops)
          )}
        </View>
      );
    }
    if (search.loading) return <Loading label={t('loading')} color={colors.textSecondary} />;
    if (search.error) return <Message text={errorText(search.error)} color={colors.textSecondary} />;
    if (search.results.length === 0) return <Message text={t('nativeNoSearchResults')} color={colors.textSecondary} />;
    return (
      <View style={styles.section}>
        {search.mode === 'stop' ? renderStopGroups(search.results) : renderRouteGroups(search.results)}
      </View>
    );
  };

  return (
    <>
      <Stack.Screen options={{ title: t('busInfo') }} />
      <ScrollView
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag">
        <SegmentedControl
          label={t('nativeBusSearchMode')}
          options={[
            { value: 'route' as const, label: t('nativeBusModeRoute'), selected: mode === 'route' },
            { value: 'stop' as const, label: t('nativeBusModeStop'), selected: mode === 'stop' },
          ]}
          onSelect={setMode}
        />
        <View style={[styles.searchBar, { backgroundColor: colors.backgroundElement }]}>
          <Icon name="search" color={colors.textSecondary} />
          <TextInput
            value={keyword}
            onChangeText={setKeyword}
            // sheet 停在 half 時鍵盤會蓋住搜尋框：聚焦就展開到全高（同首頁搜尋）
            onFocus={() => sheetController.raiseTo(SHEET_DETENTS.length - 1)}
            placeholder={mode === 'route' ? t('routeName') : t('stopName')}
            placeholderTextColor={colors.textSecondary}
            accessibilityLabel={mode === 'route' ? t('routeName') : t('stopName')}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            clearButtonMode="while-editing"
            style={[styles.input, { color: colors.text }]}
          />
        </View>
        {renderBody()}
      </ScrollView>
    </>
  );
}

function Loading({ label, color }: { label: string; color: string }) {
  return (
    <View style={styles.message} accessibilityLabel={label} accessibilityLiveRegion="polite">
      <ActivityIndicator color={color} />
    </View>
  );
}

function Message({ text, color }: { text: string; color: string }) {
  return (
    <View style={styles.message}>
      <Text accessibilityLiveRegion="polite" style={[styles.messageText, { color }]}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 32, gap: 14 },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, minHeight: 48, paddingHorizontal: 14, borderRadius: RADIUS.pill },
  input: { flex: 1, fontSize: TYPE.body, paddingVertical: 10 },
  section: { gap: 12 },
  sectionTitle: { fontSize: TYPE.headline, fontWeight: '700' },
  group: { gap: 4 },
  groupTitle: { fontSize: TYPE.subhead, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, paddingVertical: 10 },
  pressed: { opacity: 0.6 },
  iconCircle: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  rowTexts: { flex: 1, gap: 6 },
  rowTitle: { fontSize: TYPE.body, fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 4 },
  moreText: { fontSize: TYPE.caption, fontWeight: '600' },
  distance: { fontSize: TYPE.callout, fontVariant: ['tabular-nums'] },
  message: { alignItems: 'center', paddingVertical: 24 },
  messageText: { fontSize: TYPE.callout, textAlign: 'center' },
});
