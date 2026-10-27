import { Image } from 'expo-image';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useAppTranslation } from '@/shared/i18n';
import { BLACK, DANGER_FILL, SHAPE, TYPE, WHITE } from '@/shared/theme';
import { Text } from '@/shared/ui/typography/Text';

import { useMjpegStream } from '../hooks/useMjpegStream';

interface CctvLiveImageProps {
  streamUrl: string;
  /** 串流連上前先顯示的快照，避免畫面空白。 */
  posterUrl: string;
}

/** 監視器卡片的即時影像：連線中顯示快照＋轉圈，連上後逐幀更新並標示 LIVE，斷線顯示錯誤。 */
export function CctvLiveImage({ streamUrl, posterUrl }: CctvLiveImageProps) {
  const { t } = useAppTranslation();
  const stream = useMjpegStream(streamUrl);
  const uri = stream.status === 'live' ? stream.frameUri : posterUrl;

  return (
    <View style={styles.frame}>
      <Image source={{ uri }} style={styles.image} contentFit="cover" transition={0} />
      {stream.status === 'connecting' ? <ActivityIndicator style={styles.overlay} color={WHITE} /> : null}
      {stream.status === 'live' ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>LIVE</Text>
        </View>
      ) : null}
      {stream.status === 'error' ? (
        <View style={[styles.overlay, styles.errorOverlay]}>
          <Text style={styles.errorText}>{t('cctvLiveError')}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { width: '100%', aspectRatio: 16 / 9, borderRadius: SHAPE.control, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: BLACK },
  image: { width: '100%', height: '100%' },
  overlay: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  errorOverlay: { backgroundColor: 'rgba(0,0,0,0.55)' },
  errorText: { color: WHITE, fontSize: TYPE.subhead, fontWeight: '600' },
  badge: { position: 'absolute', top: 8, left: 8, borderRadius: SHAPE.badge, backgroundColor: DANGER_FILL, paddingHorizontal: 6, paddingVertical: 2 },
  badgeText: { color: WHITE, fontSize: TYPE.caption, fontWeight: '700' },
});
