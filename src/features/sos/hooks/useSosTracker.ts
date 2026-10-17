import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Linking } from 'react-native';

import { useUserLocationStore } from '@/features/map';
import { computeRoute } from '@/features/route';
import { getAppConfig } from '@/shared/config';
import { useAppTranslation } from '@/shared/i18n';
import { logger } from '@/shared/logger';
import { useCloseScreen } from '@/shared/navigation';

import {
  centerOnRequester,
  closeSosTracker,
  openSosTracker,
  retrySosTracker,
  useSosTrackerStore,
} from '../controller/trackerController';
import {
  buildLineClaimUrl,
  HANDLING_LABEL_KEY,
  locationFreshness,
  parseShareToken,
  SOS_TYPE_LABEL_KEY,
  TRACKER_PROGRESS_STEPS,
  trackerProgressIndex,
} from '../domain/sosDisplay';
import type { SosTrackerProgressStep } from '../components/SosTrackerPanel.types';

/** 「N 分鐘前更新」每 30 秒重算一次；輪詢更新資料時也會重繪。 */
function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

async function openExternal(url: string): Promise<void> {
  try {
    await Linking.openURL(url);
  } catch (error) {
    logger.warn('[sos-tracker] open url failed', error);
  }
}

/**
 * 家人端追蹤面板的 view-model。家人多半是從 LINE 通知點進來（Universal Link → `sos-track/<token>`），
 * 所以畫面要一眼回答三件事：對方在哪（位置＋多新）、現在誰在處理（進度）、我能做什麼（導航、打電話、回 LINE 回報）。
 *
 * 「導航前往」對齊 Web `handleNavigate`：以求助者當下位置為終點、一律開車、一鍵直達路線列表；
 * 路線只在按下時算一次——求助者移動不會自動重算（SDD §6.8：靜止時不自動重算），要更新就再按一次。
 */
export function useSosTracker(rawToken: string | undefined) {
  const { t, i18n } = useAppTranslation();
  const closeScreen = useCloseScreen();
  const token = parseShareToken(rawToken);
  const { phase, session } = useSosTrackerStore();
  const now = useNow(30_000);

  useEffect(() => {
    if (token) openSosTracker(token);
  }, [token]);

  const phaseMessage: Record<string, string | null> = {
    none: null,
    loading: t('locating'),
    active: null,
    resolved: t('nativeSosTrackerResolvedDesc'),
    notFound: t('sosTrackingNotFound'),
    expired: t('sosTrackingExpired'),
    error: t('sosTrackingError'),
  };

  const navigate = async () => {
    if (!session) return;
    if (!useUserLocationStore.getState().position) {
      Alert.alert(t('sosTrackingNoLocation'));
      return;
    }
    const result = await computeRoute({ destination: { lat: session.lat, lng: session.lng }, travelMode: 'drive' });
    if (result.ok) router.navigate('/routes');
    else if (result.failure !== 'superseded') Alert.alert(t('nativeRouteErrorFailed'));
  };

  const progressIndex = trackerProgressIndex(session?.handlingStatus);
  const progressSteps: SosTrackerProgressStep[] = TRACKER_PROGRESS_STEPS.map((status, index) => ({
    key: status,
    label: t(HANDLING_LABEL_KEY[status]),
    state: index < progressIndex ? 'done' : index === progressIndex ? 'current' : 'todo',
  }));

  const freshness = session ? locationFreshness(session.updatedAt, now) : null;
  const freshnessText = freshness
    ? freshness.kind === 'justNow'
      ? t('nativeSosTrackerUpdatedJustNow')
      : t('nativeSosTrackerUpdatedMinutes', { count: freshness.minutes })
    : null;

  const lineBotBasicId = getAppConfig().lineBotBasicId;

  return {
    invalidToken: !token,
    phase,
    message: token ? phaseMessage[phase] : t('sosTrackingNotFound'),
    title: t('sosTrackingTitle'),
    typeLabel: session ? t(SOS_TYPE_LABEL_KEY[session.type]) : null,
    addressText: session ? (session.address ?? `${session.lat.toFixed(5)}, ${session.lng.toFixed(5)}`) : null,
    lastUpdateText: session ? t('sosTrackingLastUpdate', { time: new Date(session.updatedAt).toLocaleString(i18n.language) }) : null,
    freshnessText,
    stale: freshness?.kind === 'minutes' && freshness.stale,
    /** 舊版後端沒有進度欄位時整塊不顯示，而不是顯示一條全空的進度。 */
    showProgress: session?.handlingStatus !== undefined,
    waitingForFamily: progressIndex < 0,
    progressSteps,
    navigate: () => void navigate(),
    locate: centerOnRequester,
    call119: () => void openExternal('tel:119'),
    call110: () => void openExternal('tel:110'),
    replyOnLine: lineBotBasicId
      ? () => void openExternal(buildLineClaimUrl(lineBotBasicId, t('nativeSosTrackerLineClaimText')))
      : null,
    retry: retrySosTracker,
    close: () => {
      closeSosTracker();
      closeScreen();
    },
  };
}

export type SosTrackerModel = ReturnType<typeof useSosTracker>;
