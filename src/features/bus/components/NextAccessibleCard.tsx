import { Text } from '@/shared/ui/typography/Text';
import { StyleSheet, View } from 'react-native';

import { ACCENT_FILL, ON_ACCENT_FILL, TYPE, SHAPE, ICON_SIZE } from '@/shared/theme';
import { Icon } from '@/shared/ui';
import PressableScale from '@/shared/ui/PressableScale';
import { Numeral } from '@/shared/ui/typography/Numeral';

/** 分段條最多畫幾格：車子離你越近，亮的格數越多。 */
const SEGMENTS = 4;

export interface NextAccessibleCardProps {
  eyebrow: string;
  routeName: string;
  /** 「往 撫遠街 · 低地板」 */
  detail: string;
  minutes: number | null;
  /** 沒有分鐘數時顯示的文字（進站中）。 */
  etaText: string;
  minuteUnit: string;
  /** 車子目前最接近的站；沒有車輛位置時省略，不畫分段條。 */
  busStopName?: string | null;
  stopsAway?: number | null;
  /** 「還有 1 站」 */
  stopsAwayText?: string | null;
  accessibilityLabel: string;
  onPress: () => void;
}

/**
 * 設計 2b 站牌頂端的主色卡：只回答「我等的那班無障礙車還要多久」。
 * 56pt 倒數；有車輛位置時下方分段條表示車子還差幾站。整張卡是一個按鈕（開路線追車）。
 */
export default function NextAccessibleCard(props: NextAccessibleCardProps) {
  const stopsAway = props.stopsAway ?? null;
  const filled = stopsAway === null ? 0 : Math.max(1, SEGMENTS - stopsAway);
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={props.accessibilityLabel}
      onPress={props.onPress}
      style={styles.card}>
      <View style={styles.eyebrowRow}>
        <Icon name="accessibility" size={ICON_SIZE.body} color={ON_ACCENT_FILL} />
        <Text style={styles.eyebrow}>{props.eyebrow}</Text>
      </View>
      <View style={styles.main}>
        <View style={styles.routeCol}>
          <Numeral style={styles.route} numberOfLines={2}>
            {props.routeName}
          </Numeral>
          <Text style={styles.detail} numberOfLines={2}>
            {props.detail}
          </Text>
        </View>
        {props.minutes !== null ? (
          <Text style={styles.eta}>
            <Numeral style={styles.etaNumber}>{props.minutes}</Numeral>
            <Text style={styles.etaUnit}> {props.minuteUnit}</Text>
          </Text>
        ) : (
          <Text style={styles.etaText}>{props.etaText}</Text>
        )}
      </View>
      {stopsAway !== null ? (
        <View style={styles.progress}>
          <View style={styles.segments}>
            {Array.from({ length: SEGMENTS }, (_, i) => (
              <View key={i} style={[styles.segment, i < filled ? styles.segmentOn : styles.segmentOff]} />
            ))}
          </View>
          <View style={styles.progressLabels}>
            <Text style={styles.progressText} numberOfLines={1}>
              {props.busStopName ?? ''}
            </Text>
            <Text style={styles.progressText}>{props.stopsAwayText ?? ''}</Text>
          </View>
        </View>
      ) : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: ACCENT_FILL, borderRadius: SHAPE.card, borderCurve: 'continuous', padding: 16, gap: 8 },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  eyebrow: { color: ON_ACCENT_FILL, fontSize: TYPE.footnote, fontWeight: '600' },
  main: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  routeCol: { flex: 1, gap: 2 },
  route: { color: ON_ACCENT_FILL, fontSize: TYPE.largeTitle, fontWeight: '700' },
  detail: { color: ON_ACCENT_FILL, fontSize: TYPE.subhead },
  eta: { color: ON_ACCENT_FILL },
  etaNumber: { fontSize: TYPE.numeralL, fontWeight: '700' },
  etaUnit: { fontSize: TYPE.title3, fontWeight: '600' },
  etaText: { color: ON_ACCENT_FILL, fontSize: TYPE.title1, fontWeight: '700' },
  progress: { gap: 6, marginTop: 4 },
  segments: { flexDirection: 'row', gap: 6 },
  segment: { flex: 1, height: 6, borderRadius: SHAPE.pill, borderCurve: 'continuous' },
  segmentOn: { backgroundColor: ON_ACCENT_FILL },
  segmentOff: { backgroundColor: 'rgba(255,255,255,0.35)' },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  progressText: { color: ON_ACCENT_FILL, fontSize: TYPE.footnote, flexShrink: 1 },
});
