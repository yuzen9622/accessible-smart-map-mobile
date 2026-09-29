import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';

import { useRouteSession } from '@/features/route';
import { formatDistance } from '@/shared/geo';
import { useAppTranslation } from '@/shared/i18n';
import { useThemeColors } from '@/shared/theme';
import { AnimatedNumberText, Icon } from '@/shared/ui';

import { endNavigation } from '../controller/navigationSession';
import { hudProgress } from '../domain/hudProgress';
import { useNavStore } from '../store/navStore';

const OK = '#1B7F3B';
const OK_DARK = '#4CD471';
const DANGER = '#C02020';

function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

/**
 * 導航 sheet 的收合列（對齊 Google Maps）：剩餘時間、距離、預計抵達；語音開關、2D/3D、結束（確認對話框）。
 * 它就是 sheet 在 peek detent 露出的全部內容，往上滑才看到下方的步驟清單。
 */
export default function NavigationTripBar() {
  const { t } = useAppTranslation();
  const colors = useThemeColors();
  const isDark = useColorScheme() === 'dark';
  const now = useNow(30_000);

  const remainingM = useNavStore((s) => s.remainingM);
  const routeTotalM = useNavStore((s) => s.routeTotalM);
  const remainingDurationSec = useNavStore((s) => s.remainingDurationSec);
  const estimatedArrivalAt = useNavStore((s) => s.estimatedArrivalAt);
  const voiceEnabled = useNavStore((s) => s.voiceEnabled);
  const viewMode = useNavStore((s) => s.viewMode);
  const routeTotalMinutes = useRouteSession((s) => s.selectRoute?.route.totalMinutes ?? null);

  const progress = hudProgress({ remainingDurationSec, remainingM, routeTotalM, routeTotalMinutes, estimatedArrivalAt, now });
  const etaText =
    progress.arrivalAt != null
      ? t('etaArrive', {
          time: new Date(progress.arrivalAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
        })
      : null;

  const confirmExit = () => {
    Alert.alert(t('exitNavTitle'), t('exitNavMessage'), [
      { text: t('exitNavCancel'), style: 'cancel' },
      { text: t('exitNavConfirm'), style: 'destructive', onPress: endNavigation },
    ]);
  };

  return (
    <View style={styles.bar}>
      <View
        accessible
        accessibilityLabel={[
          progress.remainMinutes != null ? t('minutesLeft', { count: progress.remainMinutes }) : null,
          remainingM != null ? formatDistance(remainingM) : null,
          etaText,
        ]
          .filter(Boolean)
          .join('，')}
        style={styles.flex}>
        {progress.remainMinutes != null ? (
          <AnimatedNumberText
            text={t('minutesLeft', { count: progress.remainMinutes })}
            value={progress.remainMinutes}
            fontSize={22}
            fontWeight="heavy"
            color={isDark ? OK_DARK : OK}
          />
        ) : (
          <Text style={[styles.remain, { color: isDark ? OK_DARK : OK }]}>—</Text>
        )}
        <Text style={[styles.meta, { color: colors.textSecondary }]} numberOfLines={1}>
          {[remainingM != null ? formatDistance(remainingM) : null, etaText].filter(Boolean).join(' · ')}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={voiceEnabled ? t('voiceOff') : t('voiceOn')}
        accessibilityState={{ selected: voiceEnabled }}
        onPress={() => useNavStore.getState().setVoiceEnabled(!voiceEnabled)}
        style={styles.iconButton}>
        <Icon name={voiceEnabled ? 'volumeOn' : 'volumeOff'} color={colors.text} />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={viewMode === '3d' ? t('switchTo2D') : t('switchTo3D')}
        onPress={() => useNavStore.getState().setViewMode(viewMode === '3d' ? '2d' : '3d')}
        style={styles.iconButton}>
        <Text style={[styles.viewModeText, { color: colors.text }]}>{viewMode === '3d' ? '2D' : '3D'}</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('endNav')}
        onPress={confirmExit}
        style={[styles.endButton, { backgroundColor: DANGER }]}>
        <Icon name="stop" size={16} color="#FFFFFF" />
        <Text style={styles.endText}>{t('endNav')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  flex: { flex: 1 },
  remain: { fontSize: 22, fontWeight: '800' },
  meta: { fontSize: 13 },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  viewModeText: { fontSize: 15, fontWeight: '700' },
  endButton: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, borderRadius: 22, paddingHorizontal: 14 },
  endText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});
