import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, AppState, Linking, Share } from 'react-native';

import { selectIsLoggedIn, useAuthStore } from '@/features/auth';
import { useUserLocationStore } from '@/features/map';
import { getAppConfig } from '@/shared/config';
import { useAppTranslation } from '@/shared/i18n';
import { useCloseScreen } from '@/shared/navigation';

import {
  SOS_COUNTDOWN_MS,
  abortSosCreation,
  beginSosCountdown,
  cancelSosCountdown,
  clearSosStartError,
  dismissResolvedSos,
  resolveSos,
  restartSosLifecycle,
  sendSosNow,
} from '../controller/sosController';
import { boundContactNames, buildSosShareUrl, handlingSummary, HANDLING_LABEL_KEY, TIMELINE_LABEL_KEY } from '../domain/sosDisplay';
import type { SosType } from '../domain/types';
import { useSosStore } from '../store/sosStore';

/**
 * SOS 畫面 view-model：倒數 → 進行中 → 已解除（對齊 Web `SosDialog.tsx` 的三步）。倒數、位置上傳、地址反查都在
 * controller（關掉畫面也要繼續），這裡只讀 store 與組字串。
 */
export function useSosFlow() {
  const { t, i18n } = useAppTranslation();
  const closeScreen = useCloseScreen();
  const loggedIn = useAuthStore(selectIsLoggedIn);
  const state = useSosStore();
  const position = useUserLocationStore((s) => s.position);
  const [timelineOpen, setTimelineOpen] = useState(false);

  // 打開畫面時若沒有進行中的 SOS，直接開始倒數（地圖上的 SOS 按鈕就是觸發點）。
  useEffect(() => {
    if (loggedIn) beginSosCountdown();
  }, [loggedIn]);

  // 建立失敗：提示並關閉（沒有定位時無法求救，改撥 110／119）
  useEffect(() => {
    const error = state.startError;
    if (!error) return;
    clearSosStartError();
    if (error.reason === 'noLocation') {
      Alert.alert(t('noLocation'), t('nativeSosNoLocationCall'));
    } else {
      Alert.alert(t('nativeSosCreateFailed'), error.message);
    }
  }, [state.startError, t]);

  // 回前景重新同步（SSE 在背景會斷）
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') restartSosLifecycle();
    });
    return () => sub.remove();
  }, []);

  const openTel = (number: string) => {
    const call = async () => {
      try {
        await Linking.openURL(`tel:${number}`);
      } catch (error) {
        console.warn('[sos] open tel failed', error);
      }
    };
    void call();
  };

  const shareUrl = state.shareToken ? buildSosShareUrl(getAppConfig().shareBaseUrl, i18n.language, state.shareToken) : null;

  const share = async () => {
    const message = `${t('sosShareText', { address: state.address ?? t('myLocation') })}${shareUrl ? ` ${shareUrl}` : ''}`;
    try {
      await Share.share({ message });
    } catch (error) {
      console.warn('[sos] share failed', error);
    }
  };

  const confirmResolve = () => {
    Alert.alert(t('sosResolveButton'), t('nativeSosResolveConfirm'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('sosResolveButton'),
        style: 'destructive',
        onPress: () => {
          const run = async () => {
            const { synced } = await resolveSos();
            if (!synced) Alert.alert(t('sosResolveSyncFailed'));
          };
          void run();
        },
      },
    ]);
  };

  const summary = handlingSummary(state.snapshot);
  const summaryText =
    summary.kind === 'handler'
      ? `${summary.name}・${t(summary.statusKey)}`
      : summary.kind === 'acks'
        ? t('sosAckCount', { count: summary.count })
        : t('sosContinuousSharing');
  const bound = boundContactNames(state.contacts);

  return {
    loggedIn,
    phase: state.phase,
    secondsLeft: Math.ceil(state.countdownRemainingMs / 1000),
    progress: 1 - state.countdownRemainingMs / SOS_COUNTDOWN_MS,
    summaryText,
    handlingLabel: state.snapshot ? t(HANDLING_LABEL_KEY[state.snapshot.handlingStatus]) : t('sosHandlingNotified'),
    waitingText:
      (state.snapshot?.acknowledgements.length ?? 0) > 0
        ? t('sosAckCount', { count: state.snapshot?.acknowledgements.length ?? 0 })
        : t('sosWaitingFamily'),
    notifiedText: bound.length > 0 ? bound.join('、') : t('sosNoContacts'),
    hasBoundContacts: bound.length > 0,
    addressText: state.address ?? (position ? `${position.lat.toFixed(5)}, ${position.lng.toFixed(5)}` : t('locating')),
    supplementedType: state.supplementedType,
    setSupplementedType: (type: SosType) => useSosStore.setState({ supplementedType: type }),
    timeline: (state.snapshot?.timeline ?? []).map((entry, index) => ({
      key: `${entry.at}-${index}`,
      time: new Date(entry.at).toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' }),
      text: `${entry.actorName ? `${entry.actorName} ` : ''}${t(TIMELINE_LABEL_KEY[entry.type])}${entry.note ? `・${entry.note}` : ''}`,
    })),
    timelineOpen,
    toggleTimeline: () => setTimelineOpen((open) => !open),
    locationSyncFailed: state.locationSyncFailed,
    backgroundDenied: state.backgroundDenied,
    streamStatus: state.lifecycleStatus,
    call110: () => openTel('110'),
    call119: () => openTel('119'),
    share: () => void share(),
    sendNow: sendSosNow,
    cancelCountdown: () => {
      cancelSosCountdown();
      closeScreen();
    },
    cancelCreating: () => {
      abortSosCreation();
      closeScreen();
    },
    resolve: confirmResolve,
    manageContacts: () => router.navigate('/settings/contacts'),
    login: () => router.navigate('/auth'),
    minimize: closeScreen,
    closeResolved: () => {
      dismissResolvedSos();
      closeScreen();
    },
  };
}

export type SosFlowModel = ReturnType<typeof useSosFlow>;
