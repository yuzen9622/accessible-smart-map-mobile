import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { useRouteSession } from '@/features/route';
import { formatDistance } from '@/shared/geo';
import { useAppTranslation } from '@/shared/i18n';
import { DANGER_FILL, ON_ACCENT_FILL, useSemanticColors, useThemeColors } from '@/shared/theme';
import { AnimatedNumberText, Icon } from '@/shared/ui';

import { endNavigation } from '../controller/navigationSession';
import { getNavigationSpeechOwner, useNavigationSpeechOwnerState } from '../controller/speechOwnerPort';
import { isNavigationAudioActive, resolveNavigationAudioToggle } from '../domain/navigationAudio';
import { hudProgress } from '../domain/hudProgress';
import { useNavStore } from '../store/navStore';

function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

/**
 * 導航 sheet 的收合列（1c 大字色塊）：36pt 剩餘分鐘、抵達時間與距離；52pt 語音開關與 2D/3D（同尺寸）、52 高紅色「結束」（確認對話框）。
 * 它就是 sheet 在 peek detent 露出的全部內容，往上滑才看到下方的步驟清單。
 */
export default function NavigationTripBar() {
  const { t } = useAppTranslation();
  const colors = useThemeColors();
  const now = useNow(30_000);
  const instructionError = useNavStore((s) => s.instructionError);

  const remainingM = useNavStore((s) => s.remainingM);
  const routeTotalM = useNavStore((s) => s.routeTotalM);
  const remainingDurationSec = useNavStore((s) => s.remainingDurationSec);
  const estimatedArrivalAt = useNavStore((s) => s.estimatedArrivalAt);
  const voiceEnabled = useNavStore((s) => s.voiceEnabled);
  // 喇叭鈕對應「目前實際在說話的那一方」：語音助理擁有播報時切它的靜音，否則切本機 TTS（Web useNavigationAudio）
  const speechOwner = useNavigationSpeechOwnerState();
  const audioState = { ...speechOwner, localVoiceEnabled: voiceEnabled };
  const audioActive = isNavigationAudioActive(audioState);
  const toggleAudio = () => {
    const toggle = resolveNavigationAudioToggle(audioState);
    if (toggle.target === 'gemini') getNavigationSpeechOwner().toggleGeminiMute();
    else useNavStore.getState().setVoiceEnabled(toggle.nextActive);
  };
  const viewMode = useNavStore((s) => s.viewMode);
  const routeTotalMinutes = useRouteSession((s) => s.navigationRoute?.route.totalMinutes ?? null);

  const progress = instructionError
    ? { remainMinutes: null, arrivalAt: null }
    : hudProgress({ remainingDurationSec, remainingM, routeTotalM, routeTotalMinutes, estimatedArrivalAt, now });
  const visibleRemainingM = instructionError ? null : remainingM;
  const etaText =
    progress.arrivalAt != null
      ? t('nativeEtaArriveShort', {
          time: new Date(progress.arrivalAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
        })
      : null;

  const etaLongText =
    progress.arrivalAt != null
      ? t('etaArrive', {
          time: new Date(progress.arrivalAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
        })
      : null;
  const neutral = useSemanticColors().neutral;

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
          visibleRemainingM != null ? formatDistance(visibleRemainingM) : null,
          etaLongText,
        ]
          .filter(Boolean)
          .join('，')}
        style={styles.flex}>
        <View style={styles.remainRow}>
          {progress.remainMinutes != null ? (
            <AnimatedNumberText
              text={String(progress.remainMinutes)}
              value={progress.remainMinutes}
              fontSize={36}
              fontWeight="heavy"
              color={colors.text}
            />
          ) : (
            <Text style={[styles.remain, { color: colors.text }]}>—</Text>
          )}
          {progress.remainMinutes != null ? <Text style={[styles.unit, { color: colors.text }]}>{t('nativeMinuteUnit')}</Text> : null}
        </View>
        {/* 限一行：換行會把左欄撐高，整列超出 peek detent、按鈕就不再垂直置中 */}
        <Text style={[styles.meta, { color: colors.textSecondary }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
          {[etaText, visibleRemainingM != null ? formatDistance(visibleRemainingM) : null].filter(Boolean).join(' · ')}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={audioActive ? t('voiceOff') : t('voiceOn')}
        accessibilityState={{ selected: audioActive }}
        onPress={toggleAudio}
        style={[styles.roundButton, { backgroundColor: neutral.bg }]}>
        <Icon name={audioActive ? 'volumeOn' : 'volumeOff'} size={24} color={colors.text} />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={viewMode === '3d' ? t('switchTo2D') : t('switchTo3D')}
        onPress={() => useNavStore.getState().setViewMode(viewMode === '3d' ? '2d' : '3d')}
        style={[styles.roundButton, { backgroundColor: neutral.bg }]}>
        <Text style={[styles.viewModeText, { color: colors.text }]}>{viewMode === '3d' ? '2D' : '3D'}</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('endNav')}
        onPress={confirmExit}
        style={[styles.endButton, { backgroundColor: DANGER_FILL }]}>
        <Text style={styles.endText}>{t('end')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  flex: { flex: 1 },
  // AnimatedNumberText 是原生 view、沒有文字 baseline：改底部對齊，單位字再墊高到數字的 baseline
  remainRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  remain: { fontSize: 36, fontWeight: '800' },
  unit: { fontSize: 17, fontWeight: '600', paddingBottom: 7 },
  meta: { fontSize: 15, marginTop: 2 },
  roundButton: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  viewModeText: { fontSize: 17, fontWeight: '700' },
  endButton: { height: 52, borderRadius: 26, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center' },
  endText: { color: ON_ACCENT_FILL, fontSize: 19, fontWeight: '700' },
});
