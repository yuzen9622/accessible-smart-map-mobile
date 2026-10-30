import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { IndoorNavigationContent, useIndoorStore } from '@/features/indoor';
import { sheetController } from '@/features/map';
import { NavigationStepsScreen, stopNavigationForVenueHandoff } from '@/features/navigation';
import { endRouteSession, getRouteSessionSnapshot, getVenueHandoff, selectRouteAt, useRouteSession } from '@/features/route';
import { SPACE, useThemeColors } from '@/shared/theme';
import { Button } from '@/shared/ui';
import { Text } from '@/shared/ui/typography/Text';

function captureJourney(kind: 'start' | 'handoff' | undefined) {
  if (!kind) return null;
  const session = getRouteSessionSnapshot();
  return {
    kind,
    route: kind === 'handoff' ? getVenueHandoff()?.leg ?? null : session.indoorRoute,
    requestSeq: session.requestSeq,
    outdoorRoute: kind === 'handoff' ? session.navigationRoute : null,
  };
}
type Journey = NonNullable<ReturnType<typeof captureJourney>>;
type Outcome = { journey: Journey; attempt: number } & (
  | { status: 'ready' }
  | { status: 'error'; message: string; stale: boolean }
);

/** 戶外與室內沿用同一個導航頁；入口確認只切換執行中的路段。 */
export default function NavigationSheet() {
  const { indoor } = useLocalSearchParams<{ indoor?: 'start' | 'handoff' }>();
  const guidance = useIndoorStore((state) => state.guidance);
  const sessionSeq = useRouteSession((state) => state.requestSeq);
  const indoorRoute = useRouteSession((state) => state.indoorRoute);
  const journey = useMemo(() => captureJourney(indoor), [indoor]);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [attempt, setAttempt] = useState(0);
  const controllerRef = useRef<AbortController | null>(null);
  const stoppedJourney = useRef<Journey | null>(null);
  const colors = useThemeColors();
  const replaced = Boolean(journey && (journey.requestSeq !== sessionSeq || (journey.kind === 'start' && journey.route !== indoorRoute)));
  const currentOutcome = outcome?.journey === journey && outcome.attempt === attempt ? outcome : null;
  const unavailable = Boolean(journey && (!journey.route || replaced));
  const error = unavailable ? '這條路線已變更，請重新規劃。' : currentOutcome?.status === 'error' ? currentOutcome.message : null;
  const stale = currentOutcome?.status === 'error' && currentOutcome.stale;
  const pending = Boolean(journey && !unavailable && !currentOutcome);

  useEffect(() => {
    if (!journey?.route) return;
    if (replaced) {
      const state = useIndoorStore.getState();
      if (state.plan.status === 'ready' && state.plan.data === journey.route) state.clearRoute();
      return;
    }
    const controller = new AbortController();
    controllerRef.current = controller;
    if (journey.kind === 'handoff' && stoppedJourney.current !== journey) {
      stoppedJourney.current = journey;
      stopNavigationForVenueHandoff();
    }
    const route = journey.route;
    void (async () => {
      const adopted = await useIndoorStore.getState().adoptRoute(route, controller.signal);
      const session = getRouteSessionSnapshot();
      if (controller.signal.aborted || session.requestSeq !== journey.requestSeq || (journey.kind === 'start' && session.indoorRoute !== route)) return;
      if (!adopted) {
        const state = useIndoorStore.getState();
        setOutcome({ journey, attempt, status: 'error',
          message: state.notice ?? (state.venue.status === 'error' ? state.venue.message : '無法載入路線，請重試。'),
          stale: state.notice === '建築資料已更新，請重新規劃路線。' || state.notice === '起訖地點已變更，請重新規劃路線。',
        });
        return;
      }
      useIndoorStore.getState().startGuidance();
      sheetController.raiseTo(1);
      setOutcome({ journey, attempt, status: 'ready' });
    })();
    return () => {
      controller.abort();
      if (controllerRef.current === controller) controllerRef.current = null;
    };
  }, [journey, attempt, replaced]);

  if (!indoor && guidance.status === 'idle') return <NavigationStepsScreen onContinueVenue={() => router.setParams({ indoor: 'handoff' })} />;
  const end = () => {
    useIndoorStore.getState().endGuidance();
    const session = getRouteSessionSnapshot();
    if (journey?.kind === 'start' && session.indoorRoute === journey.route) {
      router.dismissTo({ pathname: '/routes/[index]', params: { index: '0' } });
      return;
    }
    const index = journey?.outdoorRoute ? session.computeRoutes?.indexOf(journey.outdoorRoute.route) ?? -1 : -1;
    if (index >= 0) {
      selectRouteAt(index);
      router.dismissTo({ pathname: '/routes/[index]', params: { index: String(index) } });
    } else router.dismissTo('/plan');
  };
  const returnToPlan = () => {
    controllerRef.current?.abort();
    useIndoorStore.getState().clearRoute();
    if (stale && !replaced) endRouteSession();
    router.dismissTo('/plan');
  };
  return <>
    <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />
    {pending || error ? <View style={{ padding: SPACE.lg, gap: SPACE.lg, backgroundColor: colors.background }}>
      {pending ? <>
        <ActivityIndicator accessibilityLabel="載入路線" />
        <Button label="取消" onPress={returnToPlan} />
      </> : <>
        <Text style={{ color: colors.text }}>{error}</Text>
        {!unavailable && !stale ? <Button label="重試" onPress={() => setAttempt((value) => value + 1)} /> : null}
        <Button label={stale && !replaced ? '重新選擇起訖' : '返回路線規劃'} onPress={returnToPlan} />
      </>}
    </View> : <IndoorNavigationContent onEnd={end} />}
  </>;
}
