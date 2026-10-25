import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Image, StyleSheet, View } from 'react-native';
import { Text } from '@/shared/ui/typography/Text';

import { useAppTranslation } from '@/shared/i18n';
import { SHAPE, TYPE, useThemeColors } from '@/shared/theme';
import { EmptyState, ErrorState, HeaderCloseButton, LoadingState } from '@/shared/ui';

import { fetchNearbyCctv, type CctvCamera } from '../api/cctvApi';
import { formatDistance } from '@/features/map';

type LoadState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; cameras: CctvCamera[] };

/**
 * `(sheet)/cctv/[coords]` — 地點詳情「監視器」按鈕的去處：依座標查附近路口 CCTV。
 * `fetchNearbyCctv` 目前固定回空陣列（後端 API 尚未對接，見 `api/cctvApi.ts` 的 TODO），
 * 畫面先做好載入／錯誤／空清單三態，接上真正 API 後不用改這個檔案。
 */
export default function CctvScreen() {
  const { coords } = useLocalSearchParams<{ coords: string }>();
  const { t } = useAppTranslation();
  const colors = useThemeColors();

  const parts = (coords ?? '').split(',').map(Number);
  const lat = parts[0] ?? Number.NaN;
  const lng = parts[1] ?? Number.NaN;
  const validCoords = Number.isFinite(lat) && Number.isFinite(lng);

  const [state, setState] = useState<LoadState>({ status: 'loading' });

  useEffect(() => {
    if (!validCoords) return;
    const controller = new AbortController();
    const run = async () => {
      try {
        const cameras = await fetchNearbyCctv(lat, lng, controller.signal);
        if (!controller.signal.aborted) setState({ status: 'ready', cameras });
      } catch {
        if (!controller.signal.aborted) setState({ status: 'error' });
      }
    };
    void run();
    return () => controller.abort();
  }, [validCoords, lat, lng]);

  return (
    <>
      <Stack.Screen options={{ title: t('cctvScreenTitle'), headerLeft: () => <HeaderCloseButton /> }} />
      {!validCoords || state.status === 'error' ? (
        <ErrorState title={t('cctvLoadError')} systemImage="video.slash" />
      ) : state.status === 'loading' ? (
        <LoadingState />
      ) : state.cameras.length === 0 ? (
        <EmptyState title={t('cctvEmptyTitle')} description={t('cctvEmptyDescription')} systemImage="video.slash" />
      ) : (
        <FlatList
          style={{ backgroundColor: colors.background }}
          contentContainerStyle={styles.list}
          data={state.cameras}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={[styles.card, { backgroundColor: colors.backgroundElement }]}>
              <Image source={{ uri: item.imageUrl }} style={styles.thumbnail} />
              <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
                {item.name}
              </Text>
              {item.distanceMeters !== undefined ? (
                <Text style={[styles.distance, { color: colors.textSecondary }]}>{formatDistance(item.distanceMeters)}</Text>
              ) : null}
            </View>
          )}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, gap: 12 },
  card: { borderRadius: SHAPE.card, borderCurve: 'continuous', overflow: 'hidden', padding: 12, gap: 6 },
  thumbnail: { width: '100%', aspectRatio: 16 / 9, borderRadius: SHAPE.control, borderCurve: 'continuous' },
  name: { fontSize: TYPE.subhead, fontWeight: '600' },
  distance: { fontSize: TYPE.caption },
});
