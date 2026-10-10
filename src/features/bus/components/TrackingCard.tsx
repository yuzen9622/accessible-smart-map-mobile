import { Text } from '@/shared/ui/typography/Text';
import { Pressable, StyleSheet, useColorScheme, View } from 'react-native';

import { ACCENT_FILL, ON_ACCENT_FILL, RADIUS, TYPE, useSemanticColors, useThemeColors } from '@/shared/theme';
import { Icon } from '@/shared/ui';

import { pillToneStyle, type PillTone } from './palette';

/** 進度條最多畫幾個站點；更多時中間以省略號表示。 */
const MAX_NODES = 6;

export interface TrackingNode {
  key: string;
  kind: 'stop' | 'bus' | 'mine' | 'gap';
}

export interface TrackingCardProps {
  title: string;
  minutes: number | null;
  etaText: string;
  etaTone: PillTone;
  minuteUnit: string;
  /** 車子到你這站之間的站點（含兩端）；沒有車輛位置時為 null。 */
  nodes: TrackingNode[] | null;
  busLabel: string | null;
  mineLabel: string;
  busAccessible: boolean;
  noBusText: string;
  /** 「到 華山文創園區 共 2 站」 */
  rideSummary: string | null;
  reminderLabel: string;
  reminderActive: boolean;
  reminderDisabled: boolean;
  reminderError: string | null;
  onToggleReminder: () => void;
}

/** 把「車子所在站 → 你的站」壓成最多 {@link MAX_NODES} 個點。 */
export function buildTrackingNodes(busIndex: number, mineIndex: number): TrackingNode[] {
  const indices: number[] = [];
  for (let i = busIndex; i <= mineIndex; i += 1) indices.push(i);
  const toNode = (i: number): TrackingNode => ({
    key: String(i),
    kind: i === mineIndex ? 'mine' : i === busIndex ? 'bus' : 'stop',
  });
  if (indices.length <= MAX_NODES) return indices.map(toNode);
  return [
    ...indices.slice(0, 2).map(toNode),
    { key: 'gap', kind: 'gap' },
    ...indices.slice(-(MAX_NODES - 3)).map(toNode),
  ];
}

/**
 * 設計 2b「路線（追一班車）」頂端：追蹤會到你這站的那班車——大字倒數、橫向進度條畫出車子和你之間
 * 還差幾站，主按鈕是到站提醒（等車時不用一直盯著手機）。
 */
export default function TrackingCard(props: TrackingCardProps) {
  const colors = useThemeColors();
  const isDark = useColorScheme() === 'dark';
  const semantic = useSemanticColors();
  const tone = pillToneStyle(props.etaTone, isDark);
  const busFill = props.busAccessible ? ACCENT_FILL : semantic.neutral.fg;

  return (
    <View style={[styles.card, { backgroundColor: semantic.accentSoft }]}>
      <View style={styles.header}>
        <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
          {props.title}
        </Text>
        {props.minutes !== null ? (
          <Text style={{ color: tone.color }}>
            <Text style={styles.etaNumber}>{props.minutes}</Text>
            <Text style={styles.etaUnit}> {props.minuteUnit}</Text>
          </Text>
        ) : (
          <Text style={[styles.etaText, { color: tone.color }]}>{props.etaText}</Text>
        )}
      </View>

      {props.nodes ? (
        <View importantForAccessibility="no-hide-descendants" style={styles.track}>
          <View style={styles.nodes}>
            {props.nodes.map((node, i) => (
              <View key={node.key} style={[styles.nodeCell, i === 0 && styles.nodeCellFirst]}>
                {i > 0 ? <View style={[styles.line, { backgroundColor: ACCENT_FILL }]} /> : null}
                {node.kind === 'bus' ? (
                  <View style={[styles.busNode, { backgroundColor: busFill }]}>
                    <Icon name="bus" size={14} color={ON_ACCENT_FILL} />
                  </View>
                ) : node.kind === 'mine' ? (
                  <View style={[styles.mineNode, { borderColor: ACCENT_FILL, backgroundColor: colors.background }]}>
                    <View style={[styles.mineDot, { backgroundColor: ACCENT_FILL }]} />
                  </View>
                ) : node.kind === 'gap' ? (
                  <Text style={[styles.gap, { color: semantic.accent }]}>…</Text>
                ) : (
                  <View style={[styles.stopNode, { borderColor: ACCENT_FILL, backgroundColor: colors.background }]} />
                )}
              </View>
            ))}
          </View>
          <View style={styles.labels}>
            <Text style={[styles.label, { color: colors.textSecondary }]} numberOfLines={1}>
              {props.busLabel ?? ''}
            </Text>
            <Text style={[styles.label, styles.labelMine, { color: semantic.accent }]}>{props.mineLabel}</Text>
          </View>
        </View>
      ) : (
        <Text style={[styles.note, { color: colors.textSecondary }]}>{props.noBusText}</Text>
      )}

      {props.rideSummary ? <Text style={[styles.note, { color: colors.text }]}>{props.rideSummary}</Text> : null}

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: props.reminderActive, disabled: props.reminderDisabled }}
        disabled={props.reminderDisabled}
        onPress={props.onToggleReminder}
        style={({ pressed }) => [
          styles.reminder,
          props.reminderActive ? { backgroundColor: colors.background, borderColor: ACCENT_FILL, borderWidth: 1.5 } : { backgroundColor: ACCENT_FILL },
          props.reminderDisabled && styles.disabled,
          pressed && styles.pressed,
        ]}>
        <Icon name={props.reminderActive ? 'circleCheck' : 'timer'} size={18} color={props.reminderActive ? semantic.accent : ON_ACCENT_FILL} />
        <Text style={[styles.reminderText, { color: props.reminderActive ? semantic.accent : ON_ACCENT_FILL }]}>
          {props.reminderLabel}
        </Text>
      </Pressable>
      {props.reminderError ? (
        <Text accessibilityLiveRegion="polite" style={[styles.note, { color: semantic.danger.fg }]}>
          {props.reminderError}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: RADIUS.card, padding: 16, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  title: { flex: 1, fontSize: TYPE.body, fontWeight: '600' },
  etaNumber: { fontSize: 40, fontWeight: '700', fontVariant: ['tabular-nums'] },
  etaUnit: { fontSize: TYPE.body, fontWeight: '600' },
  etaText: { fontSize: TYPE.headline, fontWeight: '700' },
  track: { gap: 6 },
  nodes: { flexDirection: 'row', alignItems: 'center' },
  nodeCell: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', height: 28 },
  nodeCellFirst: { flex: 0 },
  line: { flex: 1, height: 3 },
  stopNode: { width: 12, height: 12, borderRadius: 6, borderWidth: 2 },
  busNode: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  mineNode: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  mineDot: { width: 10, height: 10, borderRadius: 5 },
  gap: { fontSize: TYPE.body, fontWeight: '700', paddingHorizontal: 2 },
  labels: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  label: { fontSize: TYPE.subhead, flexShrink: 1 },
  labelMine: { fontWeight: '600' },
  note: { fontSize: TYPE.callout },
  reminder: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 50,
    paddingHorizontal: 16,
    borderRadius: RADIUS.pill,
  },
  reminderText: { fontSize: TYPE.body, fontWeight: '600', flexShrink: 1, textAlign: 'center' },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.7 },
});
