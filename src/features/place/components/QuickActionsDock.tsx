import { router } from 'expo-router';
import { Text } from '@/shared/ui/typography/Text';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { useAppTranslation } from '@/shared/i18n';
import { RADIUS, SPACE, useSemanticColors, useThemeColors } from '@/shared/theme';
import { Icon } from '@/shared/ui';

import { useQuickActions } from '../hooks/useQuickActions';

/**
 * 「快速服務」常駐浮在地圖上的捷徑列（`app/index.tsx` 的 `overlays`），不是 sheet 內容：
 * 原本在首頁 sheet 的 idle 畫面裡，要滑開 sheet 才看得到；參考 Google 地圖的分類 chips
 * 直接浮在地圖上、不靠 sheet 撐起來（使用者回饋 2026-10-17）。
 *
 * 每顆各自一個白底膠囊（不是單一大卡片裡的色塊 tile），視覺比較輕——呼應同一輪回饋裡
 * 「sheet 看起來太厚重」的意見。
 *
 * 最後一顆「自訂」開設定頁的「首頁快速服務」區塊（啟用／排序本來就能改，見
 * `useSettingsViewModel.quickActionOptions`）；這排搬到地圖上常駐後更顯眼，卻沒有入口能改，
 * 使用者得自己摸去設定頁才找得到（使用者回饋 2026-10-17）。
 */
export default function QuickActionsDock() {
  const { t } = useAppTranslation();
  const colors = useThemeColors();
  const tones = useSemanticColors();
  const quickActions = useQuickActions();
  // 不因為清單是空的就整排消失：使用者把快速服務全部關掉後，還是要留一個「自訂」才找得回來。
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.content}
      accessibilityRole="none">
      {quickActions.map((action) => (
        <Pressable
          key={action.key}
          accessibilityRole="button"
          accessibilityLabel={action.label}
          onPress={action.onPress}
          style={({ pressed }) => [styles.chip, { backgroundColor: colors.background }, pressed && styles.pressed]}>
          <View style={[styles.iconDot, { backgroundColor: action.color }]}>
            <Icon name={action.iconName} size={14} color="#FFFFFF" />
          </View>
          <Text style={[styles.label, { color: colors.text }]} numberOfLines={1} maxFontSizeMultiplier={1.4}>
            {action.label}
          </Text>
        </Pressable>
      ))}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('customize')}
        accessibilityHint={t('customizeHint')}
        onPress={() => router.navigate('/settings')}
        style={({ pressed }) => [styles.chip, { backgroundColor: colors.background }, pressed && styles.pressed]}>
        <View style={[styles.iconDot, { backgroundColor: tones.neutral.bg }]}>
          <Icon name="settings" size={14} color={colors.textSecondary} />
        </View>
        <Text style={[styles.label, { color: colors.text }]} numberOfLines={1} maxFontSizeMultiplier={1.4}>
          {t('customize')}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { flexDirection: 'row', gap: SPACE.sm, paddingHorizontal: SPACE.lg },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: RADIUS.pill,
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  iconDot: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 14, fontWeight: '600' },
  pressed: { opacity: 0.6 },
});
