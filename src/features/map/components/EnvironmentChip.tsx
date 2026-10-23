import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { useAppTranslation } from '@/shared/i18n';
import { SPACE, useThemeColors, TYPE, SHAPE, ELEVATION } from '@/shared/theme';
import { Icon } from '@/shared/ui';
import { Text } from '@/shared/ui/typography/Text';

import { AIR_QUALITY_COLOR } from '../domain/environment';
import { useEnvironmentStore } from '../store/environmentStore';
import PressableScale from '@/shared/ui/PressableScale';

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
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={t('nativeEnvironmentChipTitle')}
      onPress={() => router.navigate('/environment')}
      style={[styles.chip, { backgroundColor: colors.background }]}>
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
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.sm,
    borderRadius: SHAPE.pill, borderCurve: 'continuous',
    paddingVertical: 6,
    paddingHorizontal: SPACE.md,
    boxShadow: ELEVATION.floating,
  },
  segment: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  text: { fontSize: TYPE.footnote, fontWeight: '600' },
});
