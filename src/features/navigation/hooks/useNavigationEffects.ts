import * as Haptics from 'expo-haptics';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useEffect, useRef } from 'react';
import { AccessibilityInfo } from 'react-native';

import { busLegKey, useBusStore } from '@/features/bus';
import { mapCamera, useMapUiStore, useUserLocationStore } from '@/features/map';
import { getRouteSessionSnapshot, useRouteSession } from '@/features/route';
import { buildCumulativePath, resolveWaypoints, type BusLeg } from '@/features/route/domain';
import { formatDistance } from '@/shared/geo';
import { useAppTranslation } from '@/shared/i18n';

import { expoSpeechPort } from '../controller/expoSpeechPort';
import { startLiveNavigationDriver } from '../controller/liveNavigationDriver';
import { resolveActiveBusLegOrdinal } from '../domain/legMode';
import { navFollowParams, navPitch, navZoomForLeg } from '../domain/navCamera';
import { gpsNearRoute } from '../domain/navigationEngine';
import { createLiveNavigationPort } from '../liveActivity/liveActivityPort';
import { useNavStore } from '../store/navStore';
import { useNavigationSession } from './useNavigationSession';

const KEEP_AWAKE_TAG = 'navigation';

/**
 * 地圖畫面掛一次：導航期間的所有副作用（SDD §6.4）。
 * - 引擎與 TTS（`useNavigationSession` + `expo-speech`）
 * - 螢幕常亮（`expo-keep-awake`）、換步驟／抵達震動（`expo-haptics`）與 VoiceOver 播報
 * - 鏡頭：GPS 在路線附近 → 原生跟隨；否則沿步驟預覽（Web step-preview camera）
 * - 導航中自動追蹤要搭的那段公車（Web `useNavigationBusTracking`）
 * - Live Activity／鎖定畫面
 */
export function useNavigationEffects(): void {
  useNavigationSession(expoSpeechPort);
  const { t } = useAppTranslation();
  const isNavigating = useNavStore((s) => s.isNavigating);
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  });

  // 常亮
  useEffect(() => {
    if (!isNavigating) return;
    const run = async () => {
      try {
        await activateKeepAwakeAsync(KEEP_AWAKE_TAG);
      } catch (error) {
        console.warn('[navigation] keep awake failed', error);
      }
    };
    void run();
    return () => {
      void deactivateKeepAwake(KEEP_AWAKE_TAG);
    };
  }, [isNavigating]);

  // 震動與 VoiceOver 播報（重算、抵達）
  useEffect(() => {
    if (!isNavigating) return;
    return useNavStore.subscribe((state, previous) => {
      if (state.currentStepIndex !== previous.currentStepIndex && state.instructions.length > 0) {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      if (state.arrived && !previous.arrived) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        AccessibilityInfo.announceForAccessibility(tRef.current('arrived'));
      }
      if (state.rerouteStatus === 'pending' && previous.rerouteStatus !== 'pending') {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        AccessibilityInfo.announceForAccessibility(tRef.current('recalculating'));
      }
    });
  }, [isNavigating]);

  // Live Activity（iOS）／常駐通知
  useEffect(() => {
    if (!isNavigating) return;
    const port = createLiveNavigationPort(() => ({
      distance: (meters) => formatDistance(meters),
      eta: (arrivalAt) =>
        tRef.current('etaArrive', {
          time: new Date(arrivalAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
        }),
      remaining: (seconds) => tRef.current('minutesLeft', { count: Math.max(1, Math.round(seconds / 60)) }),
      rerouting: tRef.current('recalculating'),
    }));
    return startLiveNavigationDriver(port);
  }, [isNavigating]);

  // 鏡頭
  useEffect(() => {
    if (!isNavigating) return;
    const route = getRouteSessionSnapshot().selectRoute?.route;
    if (!route) return;
    const cp = buildCumulativePath(route.legs);
    const firstLegType = route.legs[0]?.type;
    let following = false;

    const followNow = () => {
      const nav = useNavStore.getState();
      const params = navFollowParams(nav.instructions, nav.currentStepIndex, firstLegType, nav.viewMode);
      mapCamera.follow(params.mode, params.zoom, params.pitch);
      following = true;
      nav.setFollowPaused(false);
    };

    const previewStep = () => {
      const nav = useNavStore.getState();
      const waypoints = resolveWaypoints(nav.instructions, cp);
      const coord = waypoints[nav.currentStepIndex]?.coord;
      nav.setStepCoord(coord ?? null);
      if (coord) mapCamera.flyTo([coord.lng, coord.lat], navZoomForLeg(false), navPitch(nav.viewMode));
    };

    const position = useUserLocationStore.getState().position;
    if (gpsNearRoute(position, cp)) followNow();
    else {
      const start = cp.path[0] ?? position;
      if (start) mapCamera.flyTo([start.lng, start.lat], navZoomForLeg(false), navPitch(useNavStore.getState().viewMode));
    }

    const unsubscribeLocation = useUserLocationStore.subscribe((state, prev) => {
      if (following || state.position === prev.position) return;
      if (useNavStore.getState().followPaused) return;
      if (gpsNearRoute(state.position, cp)) followNow();
    });
    const unsubscribeNav = useNavStore.subscribe((state, prev) => {
      const stepChanged = state.currentStepIndex !== prev.currentStepIndex || state.instructions !== prev.instructions;
      if (following && (stepChanged || state.viewMode !== prev.viewMode)) {
        // 換到開車／步行段或切 2D/3D：更新跟隨模式、縮放與俯角
        const params = navFollowParams(state.instructions, state.currentStepIndex, firstLegType, state.viewMode);
        const current = useMapUiStore.getState().follow;
        if (!current || current.mode !== params.mode || current.zoom !== params.zoom || current.pitch !== params.pitch) {
          mapCamera.follow(params.mode, params.zoom, params.pitch);
        }
      }
      if (!following && stepChanged && !state.followPaused) previewStep();
      if (!state.followPaused && prev.followPaused) {
        if (gpsNearRoute(useUserLocationStore.getState().position, cp)) followNow();
        else previewStep();
      }
    });
    const unsubscribeInterrupt = useMapUiStore.subscribe((state, prev) => {
      // 使用者拖曳地圖 → 原生解除追蹤 → 顯示「回到導航」
      if (state.followInterrupted && !prev.followInterrupted) {
        following = false;
        useNavStore.getState().setFollowPaused(true);
      }
    });
    return () => {
      unsubscribeLocation();
      unsubscribeNav();
      unsubscribeInterrupt();
      mapCamera.stopFollow();
    };
  }, [isNavigating]);

  // 導航中追蹤要搭的那段公車（Web useNavigationBusTracking）
  const selectedRoute = useRouteSession((s) => s.selectRoute);
  const busOrdinal = useNavStore((s) => (s.isNavigating ? resolveActiveBusLegOrdinal(s.instructions, s.currentStepIndex) : null));
  useEffect(() => {
    if (!isNavigating || busOrdinal === null || !selectedRoute) return;
    const busLegs = selectedRoute.route.legs
      .map((leg, legIndex) => ({ leg, legIndex }))
      .filter((item): item is { leg: BusLeg; legIndex: number } => item.leg.type === 'BUS');
    const target = busLegs[busOrdinal];
    if (!target) return;
    const key = `nav:${busOrdinal}:${busLegKey(selectedRoute.route, selectedRoute.index, target.legIndex, target.leg)}`;
    if (useBusStore.getState().activeBusLeg?.key === key) return;
    useBusStore.getState().setActiveBusLeg({ key, leg: target.leg, route: selectedRoute.route });
  }, [isNavigating, busOrdinal, selectedRoute]);

  useEffect(() => {
    if (isNavigating) return;
    const active = useBusStore.getState().activeBusLeg;
    if (active?.key.startsWith('nav:')) useBusStore.getState().setActiveBusLeg(null);
  }, [isNavigating]);
}
