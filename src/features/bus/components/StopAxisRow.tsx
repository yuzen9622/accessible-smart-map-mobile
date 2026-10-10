import { Text } from '@/shared/ui/typography/Text';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { ACCENT_FILL, ON_ACCENT_FILL, TYPE, useSemanticColors, useThemeColors } from '@/shared/theme';
import { Icon } from '@/shared/ui';

export interface StopAxisRowProps {
  name: string;
  /** 「你在這裡」 */
  note?: string;
  /** 「下車」等標籤。 */
  tag?: string;
  first: boolean;
  last: boolean;
  mine: boolean;
  selected: boolean;
  /** 這站附近有車：null＝沒有；true／false＝是否為無障礙車。 */
  bus: boolean | null;
  trailing?: ReactNode;
  /** 列下方附加的動作（選中時的「設為下車站」）。 */
  footer?: ReactNode;
  accessibilityLabel: string;
  onPress: () => void;
  onLayout?: (event: LayoutChangeEvent) => void;
}

/**
 * 設計 2a「路線逐站」的一列：左側一條實線軸，公車圖示畫在軸上；你所在的站用淡底並標「你在這裡」。
 * 無障礙車與地圖上的公車 marker 同色（主色），一般車為灰色。
 */
export default function StopAxisRow(props: StopAxisRowProps) {
  const colors = useThemeColors();
  const semantic = useSemanticColors();
  const lineColor = semantic.accent;
  const busFill = props.bus ? ACCENT_FILL : semantic.neutral.fg;

  return (
    <View
      onLayout={props.onLayout}
      style={[styles.wrap, (props.mine || props.selected) && { backgroundColor: semantic.accentSoft }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={props.accessibilityLabel}
        accessibilityState={{ selected: props.selected }}
        onPress={props.onPress}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
        <View style={styles.axis} importantForAccessibility="no-hide-descendants">
          <View style={[styles.lineTop, { backgroundColor: props.first ? 'transparent' : lineColor }]} />
          <View style={[styles.lineBottom, { backgroundColor: props.last ? 'transparent' : lineColor }]} />
          {props.bus !== null ? (
            <View style={[styles.busNode, { backgroundColor: busFill, borderColor: colors.background }]}>
              <Icon name="bus" size={14} color={ON_ACCENT_FILL} />
            </View>
          ) : props.mine ? (
            <View style={[styles.mineNode, { borderColor: lineColor, backgroundColor: colors.background }]}>
              <View style={[styles.mineDot, { backgroundColor: lineColor }]} />
            </View>
          ) : (
            <View style={[styles.stopNode, { borderColor: lineColor, backgroundColor: colors.background }]} />
          )}
        </View>
        <View style={styles.texts}>
          <View style={styles.titleRow}>
            <Text style={[styles.name, { color: colors.text }, props.mine && styles.nameMine]} numberOfLines={2}>
              {props.name}
            </Text>
            {props.tag ? (
              <View style={[styles.tag, { backgroundColor: semantic.accentSoft }]}>
                <Text style={[styles.tagText, { color: semantic.accent }]}>{props.tag}</Text>
              </View>
            ) : null}
          </View>
          {props.note ? <Text style={[styles.note, { color: semantic.accent }]}>{props.note}</Text> : null}
        </View>
        {props.trailing}
      </Pressable>
      {props.footer ? (
        <View style={styles.footer}>
          {/* 軸線延伸穿過列下方的動作區，不然選中列的地方軸會斷掉 */}
          {props.last ? null : <View style={[styles.footerLine, { backgroundColor: lineColor }]} />}
          {props.footer}
        </View>
      ) : null}
    </View>
  );
}

const AXIS_WIDTH = 32;

const styles = StyleSheet.create({
  wrap: { borderRadius: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52, paddingRight: 10 },
  pressed: { opacity: 0.6 },
  axis: { width: AXIS_WIDTH, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  lineTop: { position: 'absolute', top: 0, bottom: '50%', width: 3 },
  lineBottom: { position: 'absolute', top: '50%', bottom: 0, width: 3 },
  stopNode: { width: 12, height: 12, borderRadius: 6, borderWidth: 2 },
  mineNode: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  mineDot: { width: 8, height: 8, borderRadius: 4 },
  busNode: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  texts: { flex: 1, gap: 2, paddingVertical: 8 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  name: { fontSize: TYPE.body },
  nameMine: { fontWeight: '700' },
  note: { fontSize: TYPE.caption, fontWeight: '600' },
  tag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  tagText: { fontSize: TYPE.caption, fontWeight: '700' },
  footer: { paddingLeft: AXIS_WIDTH + 10, paddingRight: 10, paddingBottom: 10 },
  footerLine: { position: 'absolute', left: AXIS_WIDTH / 2 - 1.5, top: 0, bottom: 0, width: 3 },
});
