import { Text } from '@/shared/ui/typography/Text';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useThemeColors } from '@/shared/theme';
import { Icon } from '@/shared/ui';

export interface DisclosureProps {
  label: string;
  color?: string;
  children: ReactNode;
}

/**
 * 可展開區塊（SDD §4.5「可展開明細」；Web 的 ChevronDown 摺疊）。用 RN 而非 SwiftUI `DisclosureGroup`：
 * 內容含 Lucide 圖示與 RN 元件，`@expo/ui` Host 內放不進（ADR-15／16）。
 */
export default function Disclosure({ label, color, children }: DisclosureProps) {
  const colors = useThemeColors();
  const [open, setOpen] = useState(false);
  const tint = color ?? colors.textSecondary;
  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((v) => !v)}
        style={styles.header}>
        <Icon name={open ? 'chevronUp' : 'chevronDown'} size={14} color={tint} />
        <Text style={[styles.label, { color: tint }]}>{label}</Text>
      </Pressable>
      {open ? <View style={styles.body}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44 },
  label: { fontSize: 14, fontWeight: '500', flexShrink: 1 },
  body: { gap: 6, paddingLeft: 8, paddingBottom: 4 },
});
