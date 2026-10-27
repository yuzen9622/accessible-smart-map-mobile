import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image } from 'expo-image';
import { FlatList, Pressable, StyleSheet } from 'react-native';
import { Text } from '@/shared/ui/typography/Text';

import { useAppTranslation } from '@/shared/i18n';
import { SHAPE, TYPE, useThemeColors } from '@/shared/theme';
import { EmptyState, ErrorState, HeaderCloseButton, LoadingState } from '@/shared/ui';

import { fetchNearbyCctv, type CctvCamera } from '../api/cctvApi';
import { CctvLiveImage } from '../components/CctvLiveImage';
import { formatDistance } from '@/features/map';

type LoadState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; cameras: CctvCamera[] };

/**
 * `(sheet)/cctv/[coords]` — 地點詳情「監視器」按鈕的去處：依座標查附近路口 CCTV。
 * 資料來自後端 `GET /a11y/cctv`（`api/cctvApi.ts`）：載入／錯誤／空清單三態；
 * 預設顯示快照（來源的快照可能是舊圖）；點有串流的卡片就地播放即時影像，同一時間只播一支，
 * 再點一次或點別支就停止，避免多條串流同時吃流量。沒有串流的卡片只顯示快照。
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
  const [liveId, setLiveId] = useState<string | null>(null);

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
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={styles.list}
          data={state.cameras}
          extraData={liveId}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Pressable
              style={[styles.card, { backgroundColor: colors.backgroundElement }]}
              disabled={!item.streamUrl}
              accessibilityRole={item.streamUrl ? 'button' : 'image'}
              accessibilityLabel={item.name}
              accessibilityHint={item.streamUrl ? t(liveId === item.id ? 'cctvStopLiveHint' : 'cctvPlayLiveHint') : undefined}
              onPress={() => setLiveId((current) => (current === item.id ? null : item.id))}>
              {item.streamUrl && liveId === item.id ? (
                <CctvLiveImage key={item.streamUrl} streamUrl={item.streamUrl} posterUrl={item.imageUrl} />
              ) : (
                <Image source={{ uri: item.imageUrl }} style={styles.thumbnail} contentFit="cover" />
              )}
              <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
                {item.name}
              </Text>
              {item.distanceMeters !== undefined ? (
                <Text style={[styles.distance, { color: colors.textSecondary }]}>{formatDistance(item.distanceMeters)}</Text>
              ) : null}
            </Pressable>
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
