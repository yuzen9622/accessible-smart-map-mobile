import { useEffect } from 'react';
import { AccessibilityInfo } from 'react-native';

import { useAppTranslation } from '@/shared/i18n';
import { getLocationPort, setBackgroundPositionSink, type Unsubscribe } from '@/shared/location';
import { logger } from '@/shared/logger';
import { appStorage } from '@/shared/storage';

import { createGpsPositionHandlers } from '../domain/gpsErrorHandler';
import { LAST_USER_LOCATION_KEY } from '../domain/initialCamera';
import { useUserLocationStore } from '../store/userLocationStore';

/**
 * 已授權時持續追蹤位置（前景）。權限流程由 onboarding／定位按鈕負責，這裡不主動跳系統彈窗。
 * GPS 錯誤只在「進入錯誤狀態」時播報一次（gpsErrorHandler，避免在隧道內每秒提示）。
 */
export function useLocationTracking(): void {
  const { t } = useAppTranslation();
  const permission = useUserLocationStore((state) => state.permission);
  const setPermission = useUserLocationStore((state) => state.setPermission);
  const setPosition = useUserLocationStore((state) => state.setPosition);
  const setHeading = useUserLocationStore((state) => state.setHeading);
  const setCourse = useUserLocationStore((state) => state.setCourse);
  const navigationAccuracy = useUserLocationStore((state) => state.navigationAccuracy);
  const setGpsError = useUserLocationStore((state) => state.setGpsError);
  const noLocationMessage = t('noLocation');

  useEffect(() => {
    const check = async () => {
      try {
        setPermission(await getLocationPort().getPermissionStatus());
      } catch (error) {
        logger.warn('[location] permission check failed', error);
      }
    };
    void check();
  }, [setPermission]);

  // 背景定位任務（只在導航中啟用）寫進同一個 store：導航控制器只認這一個定位來源。
  useEffect(
    () =>
      setBackgroundPositionSink((position) => {
        setCourse(position.heading);
        setPosition({ lat: position.lat, lng: position.lng });
      }),
    [setCourse, setPosition],
  );

  useEffect(() => {
    if (permission !== 'granted') return;
    const port = getLocationPort();
    const handlers = createGpsPositionHandlers({
      onLocationUpdate: setPosition,
      onHeadingUpdate: setCourse,
      storage: appStorage,
      storageKey: LAST_USER_LOCATION_KEY,
      onErrorNotification: () => {
        setGpsError(true);
        AccessibilityInfo.announceForAccessibility(noLocationMessage);
      },
    });
    let cancelled = false;
    const unsubscribers: Unsubscribe[] = [];
    const start = async () => {
      try {
        const stopPosition = await port.watch(
          // 導航中升到 best-for-navigation：導航只吃這一條定位（Web 同樣以 store 的 userLocation 為唯一來源），
          // 背景定位任務之後也寫進同一個 store。
          { accuracy: navigationAccuracy ? 'best-for-navigation' : 'high', timeIntervalMs: 1000, distanceIntervalMeters: 2 },
          handlers.handlePosition,
        );
        const stopHeading = await port.watchHeading((degrees) => setHeading(degrees));
        if (cancelled) {
          stopPosition();
          stopHeading();
          return;
        }
        unsubscribers.push(stopPosition, stopHeading);
      } catch (error) {
        handlers.handleError(error);
      }
    };
    void start();
    return () => {
      cancelled = true;
      unsubscribers.forEach((stop) => stop());
    };
  }, [permission, navigationAccuracy, setPosition, setHeading, setCourse, setGpsError, noLocationMessage]);
}
