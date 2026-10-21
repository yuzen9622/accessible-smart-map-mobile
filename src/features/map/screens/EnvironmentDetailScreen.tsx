import { ScrollView, StyleSheet, View } from 'react-native';

import { useAppTranslation } from '@/shared/i18n';
import { RADIUS, SPACE, useSemanticColors, useThemeColors } from '@/shared/theme';
import { Icon } from '@/shared/ui';
import { Text } from '@/shared/ui/typography/Text';

import { AIR_QUALITY_COLOR } from '../domain/environment';
import { useEnvironmentStore } from '../store/environmentStore';

/**
 * `EnvironmentChip` 點開的天氣／空氣品質詳情頁（`app/environment.tsx` 的 root modal，
 * 使用者回饋附圖：參考 Naver 地圖天氣卡的排版——大圖示＋大溫度、分項數值、建議文字）。
 *
 * 用 root modal（formSheet）而不是疊在 `MapScreen` 裡的 RN 絕對定位卡片：這個 app 的首頁
 * sheet（`(sheet)/explore`）本身是獨立呈現的原生 formSheet，會蓋在 `MapScreen` 整個畫面
 * 之上；疊在 `MapScreen` 子樹裡的卡片一樣會被首頁 sheet 蓋住、點了沒反應（實測）。跟
 * `train`／`review` 等其他詳情頁一樣改用 root modal，才能蓋過首頁 sheet。
 *
 * 後端 `/api/v1/a11y/environment` 目前只回傳溫度／天氣狀況／降雨機率／PM2.5／空氣品質分級／
 * 建議，沒有體感溫度、PM10、逐小時預報、資料來源與更新時間——詳情頁只排得出現有欄位
 * （使用者確認：先用現有欄位做詳情卡，等後端補齊再接）。
 */
export default function EnvironmentDetailScreen() {
  const { t } = useAppTranslation();
  const colors = useThemeColors();
  const tones = useSemanticColors();
  const info = useEnvironmentStore((state) => state.info);

  if (!info) return null;
  const { weather, airQuality } = info;
  const qualityColor = airQuality.quality ? AIR_QUALITY_COLOR[airQuality.quality] : undefined;

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      {weather.status === 'ok' ? (
        <View style={styles.heroRow}>
          <View style={[styles.heroIcon, { backgroundColor: tones.accentSoft }]}>
            <Icon name="cloudSun" size={34} color={tones.accent} />
          </View>
          <View style={styles.flex}>
            {weather.temperature !== null ? (
              <Text style={[styles.heroTemp, { color: colors.text }]}>{Math.round(weather.temperature)}°</Text>
            ) : null}
            {weather.condition ? (
              <Text style={[styles.heroCondition, { color: colors.textSecondary }]}>{weather.condition}</Text>
            ) : null}
          </View>
        </View>
      ) : null}

      <View style={styles.statRow}>
        {weather.status === 'ok' && weather.precipitationProbability !== null ? (
          <View style={[styles.statCard, { backgroundColor: colors.backgroundElement }]}>
            <Icon name="droplets" size={18} color={colors.textSecondary} />
            <Text style={[styles.statValue, { color: colors.text }]}>{weather.precipitationProbability}%</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{t('nativeWeatherRainChance')}</Text>
          </View>
        ) : null}
        {airQuality.status === 'ok' && airQuality.pm25 !== null ? (
          <View style={[styles.statCard, { backgroundColor: colors.backgroundElement }]}>
            <Icon name="wind" size={18} color={qualityColor ?? colors.textSecondary} />
            <Text style={[styles.statValue, { color: qualityColor ?? colors.text }]}>{airQuality.pm25}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]} numberOfLines={1}>
              PM2.5 · {airQuality.quality}
            </Text>
          </View>
        ) : null}
      </View>

      {airQuality.advice ? (
        <View style={[styles.adviceCard, { backgroundColor: colors.backgroundElement }]}>
          <Text style={[styles.adviceText, { color: colors.text }]}>{airQuality.advice}</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: SPACE.lg, gap: SPACE.md },
  flex: { flex: 1 },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md },
  heroIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  heroTemp: { fontSize: 44, fontWeight: '800', lineHeight: 50 },
  heroCondition: { fontSize: 16, fontWeight: '600' },
  statRow: { flexDirection: 'row', gap: SPACE.sm },
  statCard: { flex: 1, borderRadius: RADIUS.card, padding: SPACE.md, gap: 4, alignItems: 'flex-start' },
  statValue: { fontSize: 20, fontWeight: '700' },
  statLabel: { fontSize: 12, fontWeight: '600' },
  adviceCard: { borderRadius: RADIUS.card, padding: SPACE.md },
  adviceText: { fontSize: 14, lineHeight: 20 },
});
