import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, useColorScheme, View } from 'react-native';

import { useUserLocationStore } from '@/features/map';
import { formatDistance } from '@/shared/geo';
import { useAppTranslation } from '@/shared/i18n';
import { useThemeColors } from '@/shared/theme';
import { Icon } from '@/shared/ui';

import BusRow from '../components/BusRow';
import { BUS_ACCENT_COLOR, BUS_ACCENT_COLOR_DARK, BUS_BORDER_COLOR } from '../components/palette';
import SegmentedPills from '../components/SegmentedPills';
import { groupByCity, type BusStopSearchResult } from '../domain';
import { useBusSearch, type BusSearchError, type BusSearchMode } from '../hooks/useBusSearch';
import { useNearbyBusStops } from '../hooks/useNearbyBusStops';
import { useBusPanelStore, type PanelStop } from '../store/busPanelStore';

function toPanelStops(stops: BusStopSearchResult[]): PanelStop[] {
  return stops.map((s) => ({ id: s.stopUid || s.stopName, name: s.stopName, lat: s.coordinates[1], lng: s.coordinates[0] }));
}

/** 公車面板：找路線／找站牌；沒輸入關鍵字時顯示附近站牌。 */
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

  const accent = isDark ? BUS_ACCENT_COLOR_DARK : BUS_ACCENT_COLOR;
  const errorText = (error: BusSearchError) => (error === 'NO_DATA' ? t('noBusData') : t('networkError'));

  const openStop = (stop: BusStopSearchResult) =>
    router.push({
      pathname: '/bus/stop',
      params: {
        stopName: stop.stopName,
        city: stop.city,
        lat: String(stop.coordinates[1]),
        lng: String(stop.coordinates[0]),
        routes: JSON.stringify(stop.routes),
      },
    });

  const renderStopGroups = (stops: BusStopSearchResult[]) =>
    groupByCity(stops).map((group) => (
      <View key={group.city} style={styles.group}>
        <Text accessibilityRole="header" style={[styles.groupTitle, { color: colors.textSecondary }]}>
          {group.label}
        </Text>
        {group.items.map((stop) => {
          const distance = stop.distance !== undefined ? formatDistance(stop.distance) : '';
          const routesText = stop.routes.join('、');
          return (
            <BusRow
              key={`${stop.stopUid}-${stop.stopName}-${stop.coordinates.join(',')}`}
              icon="mapPin"
              title={stop.stopName}
              subtitle={routesText}
              showChevron
              trailing={distance ? <Text style={[styles.distance, { color: colors.textSecondary }]}>{distance}</Text> : undefined}
              accessibilityLabel={t('nativeBusStopRowLabel', {
                name: stop.stopName,
                city: group.label,
                distance: distance || t('nativeBusDistanceUnknown'),
                count: stop.routes.length,
              })}
              onPress={() => openStop(stop)}
            />
          );
        })}
      </View>
    ));

  const renderBody = () => {
    if (!searching) {
      if (!position) return <Message text={t('nativeBusNearbyNoLocation')} color={colors.textSecondary} />;
      return (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Icon name="mapPin" size={16} color={accent} />
            <Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.text }]}>
              {t('nativeBusNearbyStops')}
            </Text>
          </View>
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
    if (search.mode === 'stop') return <View style={styles.section}>{renderStopGroups(search.results)}</View>;
    return (
      <View style={styles.section}>
        {groupByCity(search.results).map((group) => (
          <View key={group.city} style={styles.group}>
            <Text accessibilityRole="header" style={[styles.groupTitle, { color: colors.textSecondary }]}>
              {group.label}
            </Text>
            {group.items.map((route) => (
              <BusRow
                key={`${route.city}-${route.routeName}-${route.departure}-${route.destination}`}
                icon="bus"
                title={route.routeName}
                subtitle={route.departure || route.destination ? `${route.departure} - ${route.destination}` : undefined}
                showChevron
                accessibilityLabel={t('nativeBusRouteRowLabel', {
                  route: route.routeName,
                  departure: route.departure,
                  destination: route.destination,
                  city: group.label,
                })}
                onPress={() =>
                  router.push({
                    pathname: '/bus/route',
                    params: { routeName: route.routeName, city: route.city, departure: route.departure, destination: route.destination },
                  })
                }
              />
            ))}
          </View>
        ))}
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
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag">
        <SegmentedPills
          options={[
            { value: 'route', label: t('nativeBusModeRoute') },
            { value: 'stop', label: t('nativeBusModeStop') },
          ]}
          value={mode}
          onChange={setMode}
        />
        <View style={[styles.searchBox, { borderColor: BUS_BORDER_COLOR }]}>
          <Icon name="search" size={18} color={colors.textSecondary} />
          <TextInput
            value={keyword}
            onChangeText={setKeyword}
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
  content: { padding: 16, gap: 12 },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, paddingHorizontal: 12, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth },
  input: { flex: 1, fontSize: 16, minHeight: 44 },
  section: { gap: 12 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionTitle: { fontSize: 17, fontWeight: '700' },
  group: { gap: 8 },
  groupTitle: { fontSize: 13, fontWeight: '600' },
  distance: { fontSize: 13, fontVariant: ['tabular-nums'] },
  message: { alignItems: 'center', paddingVertical: 24 },
  messageText: { fontSize: 15, textAlign: 'center' },
});
