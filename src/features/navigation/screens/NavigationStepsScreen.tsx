import { Stack } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { formatDistance } from '@/shared/geo';
import { useAppTranslation } from '@/shared/i18n';
import { useThemeColors } from '@/shared/theme';
import { Icon } from '@/shared/ui';

import { endNavigation } from '../controller/navigationSession';
import { stepIcon } from '../domain/navStepIcon';
import NavigationTripBar from '../components/NavigationTripBar';
import { useNavStore } from '../store/navStore';

const ACCENT = '#0065C8';

/**
 * `(sheet)/navigation` — 導航中的 sheet 內容（對齊 Google Maps）：最上方是收合列（剩餘時間＋語音／2D3D／結束），
 * sheet 在 peek 時只露出這一列；往上滑到 half 才看到下方的步驟清單（Web `NavigationContent.tsx`）。
 * 收合列本身就是 sheet 的一部分，不會另外浮在 sheet 上緣跟著飛。實際導航時步驟清單只供瀏覽：目前步驟一律由定位推進
 * （`navigationEngine.advanceNavigation`），不提供點選切換（對齊 Google／Apple Maps）；預覽（人不在路線附近，
 * `stepMode === 'preview'`）時可點選任一步跳過去。
 * 導航中不提供返回鍵：離開導航只能經 HUD「結束導航」確認（對齊 Web `ExitNavDialog`）。
 */
export default function NavigationStepsScreen() {
  const { t } = useAppTranslation();
  const colors = useThemeColors();
  const instructions = useNavStore((s) => s.instructions);
  const currentStepIndex = useNavStore((s) => s.currentStepIndex);
  const arrived = useNavStore((s) => s.arrived);
  const isNavigating = useNavStore((s) => s.isNavigating);
  const previewing = useNavStore((s) => s.stepMode === 'preview' && s.navigationSource === 'local');
  const showTripBar = isNavigating && !arrived;

  return (
    <>
      <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />
      {/* formSheet 根節點只能有單一捲動容器（見 `ExplorePanel`）：收合列是 sticky 的第一個子節點，捲步驟時固定在頂端 */}
      <ScrollView
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={[styles.content, !showTripBar && styles.contentTop]}
        stickyHeaderIndices={showTripBar ? [0] : undefined}>
        {showTripBar ? (
          <View style={[styles.tripBar, { backgroundColor: colors.background }]}>
            <NavigationTripBar />
          </View>
        ) : null}
        {showTripBar && instructions.length > 0 ? (
          <Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.textSecondary }]}>
            {t('stepList')}
          </Text>
        ) : null}
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
              accessible
              accessibilityRole={previewing ? 'button' : undefined}
              accessibilityLabel={[t('stepOf', { current: index + 1, total: instructions.length }), step.text, detail].filter(Boolean).join('，')}
              accessibilityHint={previewing && !active ? t('jumpToStep') : undefined}
              accessibilityState={{ selected: active }}
              disabled={!previewing}
              onPress={() => useNavStore.getState().selectPreviewStep(index)}
              style={({ pressed }) => [
                styles.row,
                { borderColor: 'rgba(120,120,128,0.3)' },
                active && styles.active,
                passed && !previewing && styles.passed,
                pressed && styles.pressed,
              ]}>
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
  content: { paddingHorizontal: 16, paddingBottom: 32, gap: 4 },
  contentTop: { paddingTop: 22 },
  tripBar: { marginHorizontal: -16, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10 },
  sectionTitle: { fontSize: 13, fontWeight: '600', paddingHorizontal: 8, paddingTop: 8, paddingBottom: 4 },
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52, paddingVertical: 8, paddingHorizontal: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderRadius: 10 },
  active: { backgroundColor: 'rgba(0,101,200,0.12)' },
  passed: { opacity: 0.5 },
  pressed: { backgroundColor: 'rgba(120,120,128,0.16)' },
  index: { width: 22, textAlign: 'right', fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] },
  text: { fontSize: 15, fontWeight: '500' },
  meta: { fontSize: 12 },
  arrived: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, flexWrap: 'wrap' },
  end: { minHeight: 44, borderRadius: 22, paddingHorizontal: 16, justifyContent: 'center', backgroundColor: ACCENT },
  endText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});
