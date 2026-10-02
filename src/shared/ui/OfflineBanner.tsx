import { useNetworkState } from 'expo-network';
import { useEffect, useRef } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View } from 'react-native';

import { useAppTranslation } from '@/shared/i18n';
import { useFontScale } from '@/shared/preferences';
import { MIN_TOUCH, TYPE, scaledSize, useSemanticColors, useThemeColors } from '@/shared/theme';

import GlassCard from './GlassCard';
import Icon from './Icon';
import type { OfflineBannerProps } from './OfflineBanner.types';

/**
 * 地圖上的離線提示：沒有網路時顯示，恢復時消失；兩種轉換都以 VoiceOver／TalkBack 播報。
 * `isInternetReachable` 只有明確為 false 才算離線（剛啟動時是 undefined，不要閃一下提示）。
 * 外觀交給 GlassCard 處理平台差異（iOS Liquid Glass／Android 不透明卡片），所以只有一份實作。
 */
export default function OfflineBanner({ message }: OfflineBannerProps) {
  const { t } = useAppTranslation();
  const colors = useThemeColors();
  const tones = useSemanticColors();
  const fontScale = useFontScale();
  const network = useNetworkState();
  const offline = network.isConnected === false || network.isInternetReachable === false;
  const wasOffline = useRef(false);

  useEffect(() => {
    if (offline === wasOffline.current) return;
    wasOffline.current = offline;
    AccessibilityInfo.announceForAccessibility(t(offline ? 'nativeOfflineTitle' : 'nativeBackOnline'));
  }, [offline, t]);

  if (!offline) return null;
  const detail = message ?? t('nativeOfflineBody');
  return (
    <GlassCard style={styles.card}>
      <View accessible accessibilityRole="alert" accessibilityLabel={`${t('nativeOfflineTitle')}，${detail}`} style={styles.row}>
        <Icon name="wifiOff" size={20} color={tones.warn.fg} />
        <View style={styles.text}>
          <Text style={[styles.title, { color: colors.text, fontSize: scaledSize(TYPE.callout, fontScale) }]}>
            {t('nativeOfflineTitle')}
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: scaledSize(TYPE.subhead, fontScale) }}>{detail}</Text>
        </View>
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: { alignSelf: 'stretch' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: MIN_TOUCH, paddingHorizontal: 14, paddingVertical: 8 },
  text: { flex: 1, gap: 2 },
  title: { fontWeight: '700' },
});
