import { router } from 'expo-router';
import { useEffect } from 'react';
import { Alert } from 'react-native';

import { useUserLocationStore } from '@/features/map';
import { computeRoute } from '@/features/route';
import { useAppTranslation } from '@/shared/i18n';
import { useCloseScreen } from '@/shared/navigation';

import { centerOnRequester, closeSosTracker, openSosTracker, useSosTrackerStore } from '../controller/trackerController';
import { parseShareToken, SOS_TYPE_LABEL_KEY } from '../domain/sosDisplay';

/**
 * 家人端追蹤面板。「導航前往」對齊 Web `handleNavigate`：以求助者當下位置為終點、一律開車、一鍵直達路線列表；
 * 路線只在按下時算一次——求助者移動不會自動重算（SDD §6.8：靜止時不自動重算），要更新就再按一次。
 */
export function useSosTracker(rawToken: string | undefined) {
  const { t, i18n } = useAppTranslation();
  const closeScreen = useCloseScreen();
  const token = parseShareToken(rawToken);
  const { phase, session } = useSosTrackerStore();

  useEffect(() => {
    if (token) openSosTracker(token);
  }, [token]);

  const phaseMessage: Record<string, string | null> = {
    none: null,
    loading: t('locating'),
    active: null,
    resolved: t('sosTrackingResolved'),
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

  return {
    invalidToken: !token,
    phase,
    message: token ? phaseMessage[phase] : t('sosTrackingNotFound'),
    title: t('sosTrackingTitle'),
    typeLabel: session ? t(SOS_TYPE_LABEL_KEY[session.type]) : null,
    addressText: session ? (session.address ?? `${session.lat.toFixed(5)}, ${session.lng.toFixed(5)}`) : null,
    lastUpdateText: session ? t('sosTrackingLastUpdate', { time: new Date(session.updatedAt).toLocaleString(i18n.language) }) : null,
    navigate: () => void navigate(),
    locate: centerOnRequester,
    close: () => {
      closeSosTracker();
      closeScreen();
    },
  };
}

export type SosTrackerModel = ReturnType<typeof useSosTracker>;
