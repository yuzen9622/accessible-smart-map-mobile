import { Stack } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { formatDistance } from '@/shared/geo';
import { useAppTranslation } from '@/shared/i18n';
import { useThemeColors } from '@/shared/theme';
import { Icon } from '@/shared/ui';

import { endNavigation } from '../controller/navigationSession';
import { stepIcon } from '../domain/navStepIcon';
import { useNavStore } from '../store/navStore';

const ACCENT = '#0065C8';

/**
 * `(sheet)/navigation` — 導航中的 sheet 內容：步驟清單（Web `NavigationContent.tsx`）。HUD 在地圖上，
 * sheet 收在低 detent 時只露出標題與目前步驟。點某一步＝手動切換（`setStepIndex`，引擎會暫停自動前進）。
 * 導航中不提供返回鍵：離開導航只能經 HUD「結束導航」確認（對齊 Web `ExitNavDialog`）。
 */
export default function NavigationStepsScreen() {
  const { t } = useAppTranslation();
  const colors = useThemeColors();
  const instructions = useNavStore((s) => s.instructions);
  const currentStepIndex = useNavStore((s) => s.currentStepIndex);
  const arrived = useNavStore((s) => s.arrived);
  const isNavigating = useNavStore((s) => s.isNavigating);

  return (
    <>
      <Stack.Screen options={{ title: t('stepList'), headerBackVisible: false, gestureEnabled: false }} />
      <ScrollView
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic">
        {arrived || !isNavigating ? (
          <View style={styles.arrived}>
            <Icon name="circleCheck" size={28} color="#1B7F3B" />
            <Text style={[styles.text, { color: colors.text }]}>{arrived ? t('arrived') : t('preparingNav')}</Text>
            {isNavigating ? (
              <Pressable accessibilityRole="button" accessibilityLabel={t('endNav')} onPress={endNavigation} style={styles.end}>
                <Text style={styles.endText}>{t('endNav')}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
        {!arrived && instructions.length === 0 ? (
          <Text style={[styles.meta, { color: colors.textSecondary }]}>{t('preparingNav')}</Text>
        ) : null}
        {instructions.map((step, index) => {
          const active = index === currentStepIndex;
          const passed = index < currentStepIndex;
          const detail = [step.streetName, step.distanceM != null ? formatDistance(step.distanceM) : null].filter(Boolean).join(' · ');
          return (
            <Pressable
              key={`${index}-${step.text}`}
              accessibilityRole="button"
              accessibilityLabel={[t('stepOf', { current: index + 1, total: instructions.length }), step.text, detail].filter(Boolean).join('，')}
              accessibilityState={{ selected: active }}
              onPress={() => useNavStore.getState().setStepIndex(index)}
              style={[styles.row, { borderColor: 'rgba(120,120,128,0.3)' }, active && styles.active, passed && styles.passed]}>
              <Text style={[styles.index, { color: active ? ACCENT : colors.textSecondary }]}>{index + 1}</Text>
              <Icon name={stepIcon(step)} size={20} color={active ? ACCENT : colors.text} />
              <View style={styles.flex}>
                <Text style={[styles.text, { color: colors.text }]}>{step.text}</Text>
                {detail ? <Text style={[styles.meta, { color: colors.textSecondary }]}>{detail}</Text> : null}
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 32, gap: 4 },
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52, paddingVertical: 8, paddingHorizontal: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderRadius: 10 },
  active: { backgroundColor: 'rgba(0,101,200,0.12)' },
  passed: { opacity: 0.5 },
  index: { width: 22, textAlign: 'right', fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] },
  text: { fontSize: 15, fontWeight: '500' },
  meta: { fontSize: 12 },
  arrived: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, flexWrap: 'wrap' },
  end: { minHeight: 44, borderRadius: 22, paddingHorizontal: 16, justifyContent: 'center', backgroundColor: ACCENT },
  endText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});
