import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAppTranslation } from '@/shared/i18n';
import { useFontScale } from '@/shared/preferences';
import { scaledSize, useThemeColors } from '@/shared/theme';
import { Icon, type IconName } from '@/shared/ui';

import type { SosTrackerModel } from '../hooks/useSosTracker';

const SOS_RED = '#C62828';

function Action({ label, icon, onPress, primary }: { label: string; icon: IconName; onPress: () => void; primary?: boolean }) {
  const colors = useThemeColors();
  const scale = useFontScale();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        { backgroundColor: primary ? SOS_RED : colors.backgroundElement },
        pressed && styles.pressed,
      ]}>
      <Icon name={icon} color={primary ? '#FFFFFF' : colors.text} />
      <Text style={{ color: primary ? '#FFFFFF' : colors.text, fontSize: scaledSize(16, scale), fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

/** 家人端追蹤面板（sheet 內，RN 版型與其他地圖 sheet 面板一致）。 */
export default function SosTrackerPanel({ model }: { model: SosTrackerModel }) {
  const { t } = useAppTranslation();
  const colors = useThemeColors();
  const scale = useFontScale();
  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
      <View style={styles.header}>
        <Icon name="siren" size={22} color={SOS_RED} />
        <Text accessibilityRole="header" style={[styles.title, { color: colors.text, fontSize: scaledSize(20, scale) }]}>
          {model.title}
        </Text>
      </View>

      {model.phase === 'loading' ? <ActivityIndicator /> : null}
      {model.message ? (
        <Text accessibilityLiveRegion="polite" style={{ color: colors.text, fontSize: scaledSize(16, scale) }}>
          {model.message}
        </Text>
      ) : null}

      {model.addressText ? (
        <View style={[styles.card, { backgroundColor: colors.backgroundElement }]} accessible>
          {model.typeLabel ? <Text style={{ color: SOS_RED, fontWeight: '700', fontSize: scaledSize(16, scale) }}>{model.typeLabel}</Text> : null}
          <Text style={{ color: colors.textSecondary, fontSize: scaledSize(13, scale) }}>{t('sosTrackingRequesterLabel')}</Text>
          <Text style={{ color: colors.text, fontSize: scaledSize(17, scale) }}>{model.addressText}</Text>
          {model.lastUpdateText ? <Text style={{ color: colors.textSecondary, fontSize: scaledSize(13, scale) }}>{model.lastUpdateText}</Text> : null}
        </View>
      ) : null}

      {model.phase === 'active' ? (
        <View style={styles.actions}>
          <Action label={t('sosTrackingNavigate')} icon="navigation" primary onPress={model.navigate} />
          <Action label={t('sosTrackingLocate')} icon="crosshair" onPress={model.locate} />
        </View>
      ) : null}
      <Action label={t('close')} icon="close" onPress={model.close} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingTop: 20, gap: 14 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontWeight: '700' },
  card: { borderRadius: 14, padding: 14, gap: 4 },
  actions: { gap: 10 },
  action: { minHeight: 52, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  pressed: { opacity: 0.7 },
});
