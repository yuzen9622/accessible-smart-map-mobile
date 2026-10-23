import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { useAppTranslation } from '@/shared/i18n';
import { RADIUS, SPACE, useThemeColors, SHADOW_COLOR } from '@/shared/theme';
import { Icon } from '@/shared/ui';
import { Text } from '@/shared/ui/typography/Text';

import { AIR_QUALITY_COLOR } from '../domain/environment';
import { useEnvironmentStore } from '../store/environmentStore';

/**
 * 地圖左上角的天氣＋空氣品質小卡片（像 Google 地圖）：溫度＋AQI 分級，點一下看詳細頁
 * （root modal `app/environment.tsx`；疊在 `MapScreen` 子樹裡的卡片會被首頁 sheet 蓋住，
 * 見 `EnvironmentDetailScreen` 的註解）。兩個來源都查不到資料時整張卡片不顯示，不佔位置
 * （測試人員回饋 2026-10-11）。
 */
export default function EnvironmentChip() {
  const { t } = useAppTranslation();
  const colors = useThemeColors();
  const info = useEnvironmentStore((state) => state.info);

  if (!info) return null;
  const { weather, airQuality } = info;
  if (weather.status !== 'ok' && airQuality.status !== 'ok') return null;

  const qualityColor = airQuality.quality ? AIR_QUALITY_COLOR[airQuality.quality] : undefined;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('nativeEnvironmentChipTitle')}
      onPress={() => router.navigate('/environment')}
      style={({ pressed }) => [styles.chip, { backgroundColor: colors.background }, pressed && styles.pressed]}>
      {weather.status === 'ok' && weather.temperature !== null ? (
        <View style={styles.segment}>
          <Icon name="thermometer" size={15} color={colors.textSecondary} />
          <Text style={[styles.text, { color: colors.text }]}>{Math.round(weather.temperature)}°</Text>
        </View>
      ) : null}
      {airQuality.status === 'ok' && airQuality.quality ? (
        <View style={styles.segment}>
          <Icon name="wind" size={15} color={qualityColor ?? colors.textSecondary} />
          <Text style={[styles.text, { color: qualityColor ?? colors.text }]} numberOfLines={1}>
            {airQuality.quality}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.sm,
    borderRadius: RADIUS.pill,
    paddingVertical: 6,
    paddingHorizontal: SPACE.md,
    shadowColor: SHADOW_COLOR,
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  segment: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  text: { fontSize: 13, fontWeight: '600' },
  pressed: { opacity: 0.7 },
});
