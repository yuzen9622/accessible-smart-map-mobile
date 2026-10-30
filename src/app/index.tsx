import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useIndoorMapSync } from '@/composition/useIndoorMapSync';

import { AIResultLayer } from '@/features/ai';
import { BusStopLayer, LiveBusLayer, useLiveBusTracking } from '@/features/bus';
import { HazardLayer } from '@/features/hazard';
import { IndoorMapControls, IndoorMapLayer, VenueFootprintLayer, useIndoorStore } from '@/features/indoor';
import { EnvironmentChip, MapScreen, useEnvironment } from '@/features/map';
import { NavigationHUD, useNavStore, useNavigationEffects } from '@/features/navigation';
import { needsOnboarding, useOnboardingStore } from '@/features/onboarding';
import { openVenuePlace, PlacePinLayer, ReturnToSearchButton } from '@/features/place';
import { RouteFacilityLayer, RouteLayer, RouteSessionPill, useRouteSession } from '@/features/route';
import { SosButton, SosTrackerLayer } from '@/features/sos';
import { VoiceFloatingIndicator } from '@/features/voice';
import { useAppTranslation } from '@/shared/i18n';
import { OfflineBanner } from '@/shared/ui';
import { SOS_BUTTON } from '@/shared/theme';

/**
 * 地圖主畫面的組裝點（SDD §4.4）：map 不能反向 import route／navigation／bus（會形成 require cycle），
 * 跨 feature 的圖層與疊加控制都在這裡以 slot 傳給 MapScreen。
 */
export default function Index() {
  // MMKV 同步 hydrate，第一個 render 就能判斷，不會對回訪使用者閃一下引導
  const shouldOnboard = useOnboardingStore(needsOnboarding);
  const isNavigating = useNavStore((s) => s.isNavigating);
  const indoorActive = useIndoorStore((s) => s.active);
  const indoorGuiding = useIndoorStore((s) => s.guidance.status !== 'idle');
  useIndoorMapSync();
  // 跟 `RouteFacilityLayer` 內部同一個判斷：有沒有路線可畫沿途設施。有的話常駐 `FacilityLayer`
  // 讓出，避免兩個圖層各自 cluster、同一個設施點在路線起訖點附近疊畫兩次（見 MapScreen 的
  // `facilityLayerEnabled` 註解）。
  const hasRouteFacilities = useRouteSession((s) => Boolean(s.navigationRoute?.route ?? s.selectRoute?.route));
  const insets = useSafeAreaInsets();
  const { t } = useAppTranslation();
  // HUD 橫幅實際高度（含 safe-area top）；轉彎指示文字長短會變，量實際高度才不會被蓋住
  // （使用者回饋 2026-10-15：之前寫死 190 猜測值，文字一多行就蓋到語音膠囊）。
  const [hudBannerHeight, setHudBannerHeight] = useState(190);
  useNavigationEffects();
  useLiveBusTracking();
  useEnvironment();

  useEffect(() => {
    if (shouldOnboard) router.navigate('/onboarding');
  }, [shouldOnboard]);

  return (
    <MapScreen
      navigationMode={isNavigating || indoorGuiding}
      // 引導未完成前不帶出首頁 sheet，否則 sheet 會疊在引導 modal 上（擋住底部按鈕、略過也關不掉）
      homeSheetEnabled={!shouldOnboard}
      facilityLayerEnabled={!hasRouteFacilities && !indoorActive}
      buildingExtrusionEnabled={!indoorActive}
      perspectivePitch={indoorActive ? 48 : undefined}
      layers={
        <>
          {!isNavigating ? <VenueFootprintLayer /> : null}
          <HazardLayer />
          <PlacePinLayer />
          <BusStopLayer />
          <RouteLayer />
          <RouteFacilityLayer />
          <AIResultLayer />
          <LiveBusLayer />
          {indoorActive ? <IndoorMapLayer onSelectPlace={(venueId, placeId) => openVenuePlace({ venueId, placeId })} /> : null}
          <SosTrackerLayer />
        </>
      }
      overlays={
        <>
          {isNavigating ? (
            <>
              <NavigationHUD
                onBannerHeightChange={setHudBannerHeight}
                onContinueVenue={() => router.navigate({ pathname: '/navigation', params: { indoor: 'handoff' } })}
              />
              {/* 離線提示與語音對話膠囊：導航中放到 HUD 下方，不擋轉向提示。
                  `hudBannerHeight` 已含 safe-area top，不用再加 insets.top；HUD 現在量的是橫幅
                  連同下方重新規劃／警示卡的整塊高度（見 NavigationHUD），警示卡展開時語音膠囊才會
                  跟著往下移，不會疊在一起。 */}
              <View pointerEvents="box-none" style={[styles.voiceFloating, { top: hudBannerHeight + 16 }]}>
                <OfflineBanner message={t('nativeOfflineNavigating')} />
                <VoiceFloatingIndicator />
              </View>
            </>
          ) : (
            // 非導航時：天氣／回到路線膠囊欄跟語音對話膠囊收進同一個直欄，用 flexbox 自然依序往下排，
            // 不再各自用 onLayout 量高度、換算偏移量貼上去——有進行中的路線時上方會多疊一顆
            // 「回到路線」膠囊，量測與渲染之間的時序落差曾讓語音膠囊疊在天氣／路線膠囊上
            // （使用者回饋 2026-10-23：語音功能＋導航時左上角重疊）。
            <View pointerEvents="box-none" style={[styles.topColumn, { top: insets.top + 8 }]}>
              <View pointerEvents="box-none" style={styles.pill}>
                {indoorActive ? <IndoorMapControls /> : <EnvironmentChip />}
                <RouteSessionPill isNavigating={isNavigating || indoorGuiding} />
              </View>
              <View pointerEvents="box-none" style={styles.voice}>
                <OfflineBanner />
                <VoiceFloatingIndicator />
              </View>
            </View>
          )}
          {/* SOS 在導航中也要按得到（行動不便者最可能在路上需要求助）：導航時移到 HUD 下方。
              跟上方「定位／圖層」按鈕欄拉開更大間距，降低誤觸（方案 A，測試人員回饋 2026-10-11）。 */}
          <View pointerEvents="box-none" style={[styles.sos, { top: isNavigating ? hudBannerHeight + 106 : insets.top + SOS_BUTTON.top }]}>
            <SosButton />
          </View>
          {isNavigating || indoorActive ? null : <ReturnToSearchButton />}
        </>
      }
    />
  );
}

const styles = StyleSheet.create({
  // 非導航時天氣／路線膠囊欄＋語音膠囊的共同容器：一個 flexbox 直欄，子項目自然依序往下排。
  topColumn: { position: 'absolute', left: 16, right: 80, gap: 12 },
  pill: { alignItems: 'flex-start', gap: 8 },
  // 跟 MapControls（定位／3D）的右邊界對齊——兩處以前差 4pt，三顆在螢幕右側疊成一欄時那條邊看起來沒對齊。
  sos: { position: 'absolute', right: 16 },
  voice: { alignItems: 'flex-start', gap: 8 },
  // 導航中：語音膠囊不在 topColumn 裡（HUD 本身已經是獨立的頂部橫幅），改用 hudBannerHeight 貼在其下方。
  voiceFloating: { position: 'absolute', left: 16, right: 80, alignItems: 'flex-start', gap: 8 },
});
