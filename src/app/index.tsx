import { router } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AIResultLayer } from '@/features/ai';
import { BusStopLayer, LiveBusLayer, useLiveBusTracking } from '@/features/bus';
import { HazardLayer } from '@/features/hazard';
import { MapScreen } from '@/features/map';
import { NavigationHUD, useNavStore, useNavigationEffects } from '@/features/navigation';
import { needsOnboarding, useOnboardingStore } from '@/features/onboarding';
import { PlacePinLayer } from '@/features/place';
import { RouteLayer, RouteSessionPill } from '@/features/route';
import { SosButton, SosTrackerLayer } from '@/features/sos';
import { VoiceFloatingIndicator } from '@/features/voice';

/**
 * 地圖主畫面的組裝點（SDD §4.4）：map 不能反向 import route／navigation／bus（會形成 require cycle），
 * 跨 feature 的圖層與疊加控制都在這裡以 slot 傳給 MapScreen。
 */
export default function Index() {
  // MMKV 同步 hydrate，第一個 render 就能判斷，不會對回訪使用者閃一下引導
  const shouldOnboard = useOnboardingStore(needsOnboarding);
  const isNavigating = useNavStore((s) => s.isNavigating);
  const insets = useSafeAreaInsets();
  useNavigationEffects();
  useLiveBusTracking();

  useEffect(() => {
    if (shouldOnboard) router.push('/onboarding');
  }, [shouldOnboard]);

  return (
    <MapScreen
      navigationMode={isNavigating}
      layers={
        <>
          <HazardLayer />
          <PlacePinLayer />
          <BusStopLayer />
          <RouteLayer />
          <AIResultLayer />
          <LiveBusLayer />
          <SosTrackerLayer />
        </>
      }
      overlays={
        <>
          {isNavigating ? (
            <NavigationHUD />
          ) : (
            <View pointerEvents="box-none" style={[styles.pill, { top: insets.top + 8 }]}>
              <RouteSessionPill isNavigating={isNavigating} />
            </View>
          )}
          {/* 語音對話膠囊：聊天關著或切回文字時顯示；導航中放到 HUD 下方，不擋轉向提示 */}
          <View pointerEvents="box-none" style={[styles.voice, { top: insets.top + (isNavigating ? 190 : 60) }]}>
            <VoiceFloatingIndicator />
          </View>
          {/* SOS 在導航中也要按得到（行動不便者最可能在路上需要求助）：導航時移到 HUD 下方 */}
          <View pointerEvents="box-none" style={[styles.sos, { top: insets.top + (isNavigating ? 250 : 190) }]}>
            <SosButton />
          </View>
        </>
      }
    />
  );
}

const styles = StyleSheet.create({
  pill: { position: 'absolute', left: 16, right: 72, alignItems: 'flex-start' },
  sos: { position: 'absolute', right: 12 },
  voice: { position: 'absolute', left: 16, right: 80, alignItems: 'flex-start' },
});
