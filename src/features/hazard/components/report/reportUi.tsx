import { Text } from '@/shared/ui/typography/Text';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { ACCENT_FILL, MAX_FONT_SCALE, MIN_TOUCH, ON_ACCENT_FILL, RADIUS, TYPE, useSemanticColors, useThemeColors, type ToneColors } from '@/shared/theme';
import { Icon, type IconName } from '@/shared/ui';

import type { ReportTone } from '../../domain/review';

/** 回報頁面共用的小元件（RN 版型，兩平台一致；與地點／通報詳情面板同一套 token）。 */

export function useToneColors(tone: ReportTone): ToneColors {
  const semantic = useSemanticColors();
  switch (tone) {
    case 'accepted':
      return semantic.ok;
    case 'attention':
      return semantic.warn;
    case 'rejected':
      return semantic.danger;
    case 'reviewing':
      return { fg: semantic.accent, bg: semantic.accentSoft };
    default:
      return semantic.neutral;
  }
}

export const TONE_ICON: Record<ReportTone, IconName> = {
  accepted: 'circleCheck',
  reviewing: 'clock',
  attention: 'alert',
  rejected: 'circleX',
  neutral: 'info',
};

export function StatusPill({ label, tone }: { label: string; tone: ReportTone }) {
  const color = useToneColors(tone);
  return (
    <View style={[styles.pill, { backgroundColor: color.bg }]}>
      <View style={[styles.dot, { backgroundColor: color.fg }]} />
      <Text maxFontSizeMultiplier={MAX_FONT_SCALE.label} style={[styles.pillText, { color: color.fg }]}>
        {label}
      </Text>
    </View>
  );
}

export function SectionTitle({ children, icon }: { children: string; icon?: IconName }) {
  const colors = useThemeColors();
  return (
    <View style={styles.sectionTitle}>
      {icon ? <Icon name={icon} size={16} color={colors.textSecondary} /> : null}
      <Text maxFontSizeMultiplier={MAX_FONT_SCALE.heading} accessibilityRole="header" style={[styles.sectionTitleText, { color: colors.text }]}>
        {children}
      </Text>
    </View>
  );
}

export function ActionButton({
  label,
  onPress,
  icon,
  variant = 'primary',
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  icon?: IconName;
  variant?: 'primary' | 'secondary' | 'plain';
  disabled?: boolean;
}) {
  const colors = useThemeColors();
  const background = variant === 'primary' ? ACCENT_FILL : variant === 'secondary' ? colors.backgroundElement : 'transparent';
  const foreground = variant === 'primary' ? ON_ACCENT_FILL : variant === 'secondary' ? colors.text : colors.textSecondary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variant === 'plain' && styles.plainButton,
        { backgroundColor: background },
        (pressed || disabled) && styles.dim,
      ]}>
      {icon ? <Icon name={icon} size={18} color={foreground} /> : null}
      <Text maxFontSizeMultiplier={MAX_FONT_SCALE.label} style={[styles.buttonText, { color: foreground }]}>
        {label}
      </Text>
    </Pressable>
  );
}

/** 可收合區塊（取代 Web `<details>`）：預設收合，展開狀態以 `accessibilityState.expanded` 告知讀屏。 */
export function Disclosure({ title, icon, children }: { title: string; icon: IconName; children: ReactNode }) {
  const colors = useThemeColors();
  const semantic = useSemanticColors();
  const [open, setOpen] = useState(false);
  return (
    <View style={[styles.disclosure, { borderColor: semantic.separator }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((v) => !v)}
        style={({ pressed }) => [styles.disclosureHeader, pressed && styles.dim]}>
        <Icon name={icon} size={16} color={colors.textSecondary} />
        <Text maxFontSizeMultiplier={MAX_FONT_SCALE.label} style={[styles.disclosureTitle, { color: colors.text }]}>
          {title}
        </Text>
        <Icon name={open ? 'chevronUp' : 'chevronDown'} size={16} color={colors.textSecondary} />
      </Pressable>
      {open ? <View style={[styles.disclosureBody, { borderTopColor: semantic.separator }]}>{children}</View> : null}
    </View>
  );
}

export function Bullets({ items }: { items: string[] }) {
  const colors = useThemeColors();
  return (
    <View style={styles.bullets}>
      {items.map((item) => (
        <View key={item} style={styles.bulletRow}>
          <Text style={[styles.body, { color: colors.textSecondary }]} importantForAccessibility="no">
            •
          </Text>
          <Text maxFontSizeMultiplier={MAX_FONT_SCALE.body} style={[styles.body, styles.flex, { color: colors.text }]}>
            {item}
          </Text>
        </View>
      ))}
    </View>
  );
}

export function KeyValue({ label, value }: { label: string; value: string }) {
  const colors = useThemeColors();
  // 大字級時左右並排會把標籤擠成一字一行：改成上下堆疊
  const stacked = useWindowDimensions().fontScale >= 1.4;
  return (
    <View accessible accessibilityLabel={`${label}：${value}`} style={stacked ? styles.keyValueStacked : styles.keyValue}>
      <Text maxFontSizeMultiplier={MAX_FONT_SCALE.body} style={[styles.small, !stacked && styles.flex, { color: colors.textSecondary }]}>
        {label}
      </Text>
      <Text maxFontSizeMultiplier={MAX_FONT_SCALE.body} style={[styles.small, !stacked && styles.keyValueValue, { color: colors.text }]}>
        {value}
      </Text>
    </View>
  );
}

export const reportStyles = StyleSheet.create({
  body: { fontSize: TYPE.callout, lineHeight: 22 },
  small: { fontSize: TYPE.subhead, lineHeight: 19 },
  card: { borderRadius: RADIUS.card, padding: 16, gap: 8 },
});

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: reportStyles.body,
  small: reportStyles.small,
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', borderRadius: RADIUS.pill, paddingHorizontal: 10, paddingVertical: 4 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  pillText: { fontSize: TYPE.caption, fontWeight: '600' },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionTitleText: { fontSize: TYPE.callout, fontWeight: '700' },
  button: {
    minHeight: MIN_TOUCH,
    borderRadius: RADIUS.small,
    paddingHorizontal: 16,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plainButton: { alignSelf: 'flex-start', paddingHorizontal: 4 },
  buttonText: { fontSize: TYPE.callout, fontWeight: '600', flexShrink: 1, textAlign: 'center' },
  dim: { opacity: 0.55 },
  disclosure: { borderWidth: StyleSheet.hairlineWidth, borderRadius: RADIUS.card, overflow: 'hidden' },
  disclosureHeader: { minHeight: MIN_TOUCH, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14 },
  disclosureTitle: { flex: 1, fontSize: TYPE.callout, fontWeight: '600' },
  disclosureBody: { borderTopWidth: StyleSheet.hairlineWidth, padding: 14, gap: 12 },
  bullets: { gap: 6 },
  bulletRow: { flexDirection: 'row', gap: 8 },
  keyValue: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  keyValueStacked: { gap: 2 },
  keyValueValue: { textAlign: 'right', flexShrink: 1 },
});
