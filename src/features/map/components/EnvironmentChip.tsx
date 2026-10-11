import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { useAppTranslation } from '@/shared/i18n';
import { RADIUS, SPACE, useThemeColors } from '@/shared/theme';
import { Icon } from '@/shared/ui';
import { Text } from '@/shared/ui/typography/Text';

import { useEnvironmentStore } from '../store/environmentStore';

/** 空氣品質分級對應的文字顏色（跟後端 `classifyPm25` 的中文分級一一對應）；
 * 沒有對應到（例如降級時缺資料）就用預設文字色，不特別上色。 */
const AIR_QUALITY_COLOR: Record<string, string> = {
  良好: '#2B8A3E',
  普通: '#E8A33D',
  對敏感族群不健康: '#E8590C',
  不健康: '#C92A2A',
  非常不健康: '#862E2E',
};

/**
 * 地圖左上角的天氣＋空氣品質小卡片（像 Google 地圖）：溫度＋AQI 分級，點一下看詳細建議。
 * 兩個來源都查不到資料時整張卡片不顯示，不佔位置（測試人員回饋 2026-10-11）。
 */
export default function EnvironmentChip() {
  const { t } = useAppTranslation();
  const colors = useThemeColors();
  const info = useEnvironmentStore((state) => state.info);

  if (!info) return null;
  const { weather, airQuality } = info;
  if (weather.status !== 'ok' && airQuality.status !== 'ok') return null;

  const qualityColor = airQuality.quality ? AIR_QUALITY_COLOR[airQuality.quality] : undefined;

  const showDetail = () => {
    const lines = [
      weather.condition ? `${t('nativeWeatherCondition')}：${weather.condition}` : null,
      weather.precipitationProbability !== null ? `${t('nativeWeatherRainChance')}：${weather.precipitationProbability}%` : null,
      airQuality.pm25 !== null ? `PM2.5：${airQuality.pm25}` : null,
      airQuality.advice ? airQuality.advice : null,
    ].filter((line): line is string => line !== null);
    Alert.alert(t('nativeEnvironmentChipTitle'), lines.length > 0 ? lines.join('\n') : t('nativeEnvironmentNoDetail'));
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('nativeEnvironmentChipTitle')}
      onPress={showDetail}
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
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  segment: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  text: { fontSize: 13, fontWeight: '600' },
  pressed: { opacity: 0.7 },
});
