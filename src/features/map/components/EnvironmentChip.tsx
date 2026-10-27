import { router } from 'expo-router';
import { StyleSheet, View, useWindowDimensions } from 'react-native';

import { useAppTranslation } from '@/shared/i18n';
import { SPACE, useThemeColors, TYPE, SHAPE, ICON_SIZE, SOS_BUTTON } from '@/shared/theme';
import { Icon } from '@/shared/ui';
import { Text } from '@/shared/ui/typography/Text';

import { AIR_QUALITY_COLOR } from '../domain/environment';
import { weatherIcon } from '../domain/weatherIcon';
import { useEnvironmentStore } from '../store/environmentStore';
import PressableScale from '@/shared/ui/PressableScale';
import EnvironmentChipSurface from './EnvironmentChipSurface';

/**
 * 地圖左上角的天氣＋空氣品質小卡片（像 Google 地圖）：溫度＋AQI 分級，點一下看詳細頁
 * （root modal `app/environment.tsx`；疊在 `MapScreen` 子樹裡的卡片會被首頁 sheet 蓋住，
 * 見 `EnvironmentDetailScreen` 的註解）。兩個來源都查不到資料時整張卡片不顯示，不佔位置
 * （測試人員回饋 2026-10-11）。
 */
export default function EnvironmentChip() {
  const { t } = useAppTranslation();
  const colors = useThemeColors();
  const { width } = useWindowDimensions();
  // RNHostView 依內容量測，需明確保留地圖左右內距及右側控制欄。
  const maxWidth = Math.max(0, width - SPACE.md * 2 - SOS_BUTTON.size);
  const info = useEnvironmentStore((state) => state.info);

  if (!info) return null;
  const { weather, airQuality } = info;
  if (weather.status !== 'ok' && airQuality.status !== 'ok') return null;

  const conditionIcon = weatherIcon(weather.condition);
  const qualityColor = airQuality.quality ? AIR_QUALITY_COLOR[airQuality.quality] : undefined;

  return (
    <EnvironmentChipSurface>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={[t('nativeEnvironmentChipTitle'), weather.status === 'ok' ? weather.condition : null].filter(Boolean).join('，')}
        onPress={() => router.navigate('/environment')}
        style={[styles.chip, { maxWidth }]}>
        {weather.status === 'ok' && weather.temperature !== null ? (
          <View style={styles.segment}>
            {conditionIcon ? <Icon name={conditionIcon} size={ICON_SIZE.caption} color={colors.textSecondary} /> : null}
            <Text style={[styles.text, { color: colors.text }]}>{Math.round(weather.temperature)}°</Text>
          </View>
        ) : null}
        {airQuality.status === 'ok' && airQuality.quality ? (
          <View style={[styles.segment, styles.shrink]}>
            <Icon name="wind" size={ICON_SIZE.caption} color={qualityColor ?? colors.textSecondary} />
            <Text style={[styles.text, styles.shrink, { color: qualityColor ?? colors.text }]} numberOfLines={1}>
              {airQuality.quality}
            </Text>
          </View>
        ) : null}
      </PressableScale>
    </EnvironmentChipSurface>
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
  },
  segment: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  shrink: { flexShrink: 1 },
  text: { fontSize: TYPE.footnote, fontWeight: '600' },
});
