import { Text } from '@/shared/ui/typography/Text';
import { StyleSheet, useColorScheme, View } from 'react-native';

import { pillToneStyle, type PillTone } from './palette';

interface EtaPillProps {
  text: string;
  tone: PillTone;
}

/** 到站徽章：顏色之外一律有文字，不靠顏色單獨傳達狀態。 */
export default function EtaPill({ text, tone }: EtaPillProps) {
  const isDark = useColorScheme() === 'dark';
  const { color, surface } = pillToneStyle(tone, isDark);
  return (
    <View style={[styles.pill, { backgroundColor: surface }]}>
      <Text style={[styles.text, { color }, tone === 'arriving' && styles.bold]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, flexShrink: 0 },
  text: { fontSize: 13, fontVariant: ['tabular-nums'] },
  bold: { fontWeight: '700' },
});
