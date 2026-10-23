import { StyleSheet, useColorScheme, View } from 'react-native';

import { pillToneStyle, type PillTone } from './palette';
import { TYPE, SHAPE } from '@/shared/theme';
import { Numeral } from '@/shared/ui/typography/Numeral';

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
      <Numeral style={[styles.text, { color }, tone === 'arriving' && styles.bold]}>{text}</Numeral>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: SHAPE.pill, borderCurve: 'continuous', flexShrink: 0 },
  text: { fontSize: TYPE.footnote },
  bold: { fontWeight: '700' },
});
