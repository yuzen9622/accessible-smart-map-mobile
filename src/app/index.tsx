import { router, usePathname } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AIResultLayer } from '@/features/ai';
import { BusStopLayer, LiveBusLayer, useLiveBusTracking } from '@/features/bus';
import { HazardLayer } from '@/features/hazard';
import { EnvironmentChip, MapScreen, SHEET_DETENTS, useEnvironment, useMapUiStore } from '@/features/map';
import { NavigationHUD, useNavStore, useNavigationEffects } from '@/features/navigation';
import { needsOnboarding, useOnboardingStore } from '@/features/onboarding';
import { PlacePinLayer, QuickActionsDock } from '@/features/place';
import { RouteFacilityLayer, RouteLayer, RouteSessionPill } from '@/features/route';
import { SosButton, SosTrackerLayer } from '@/features/sos';
import { VoiceFloatingIndicator } from '@/features/voice';
import { useAppTranslation } from '@/shared/i18n';
import { OfflineBanner } from '@/shared/ui';

/**
 * 地圖主畫面的組裝點（SDD §4.4）：map 不能反向 import route／navigation／bus（會形成 require cycle），
 * 跨 feature 的圖層與疊加控制都在這裡以 slot 傳給 MapScreen。
 */
export default function Index() {
  // MMKV 同步 hydrate，第一個 render 就能判斷，不會對回訪使用者閃一下引導
  const shouldOnboard = useOnboardingStore(needsOnboarding);
  const isNavigating = useNavStore((s) => s.isNavigating);
  const insets = useSafeAreaInsets();
  const { t } = useAppTranslation();
  const pathname = usePathname();
  const { height: windowHeight } = useWindowDimensions();
  const sheetInset = useMapUiStore((s) => s.sheetInset);
  // 只在首頁 sheet 落在 peek（收合）時顯示：位置固定貼齊 peek 高度之上，不跟著 sheetInset
  // 即時連動——sheet 被拉到 half／full 時膠囊列若跟著往上飄，會撞到頂部的定位／圖層／語音膠囊，
  // 位置也會跑掉看起來很怪（使用者回饋 2026-10-17：「上滑後位子也不太對」）。使用者想看捷徑時
  // 把 sheet 收回 peek 即可，不需要在每個 detent 都硬擠一排。
  const peekInset = Math.round(SHEET_DETENTS[0] * windowHeight);
  const showQuickActionsDock = !isNavigating && pathname === '/explore' && sheetInset <= peekInset + 4;
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
      navigationMode={isNavigating}
      // 引導未完成前不帶出首頁 sheet，否則 sheet 會疊在引導 modal 上（擋住底部按鈕、略過也關不掉）
      homeSheetEnabled={!shouldOnboard}
      layers={
        <>
          <HazardLayer />
          <PlacePinLayer />
          <BusStopLayer />
          <RouteLayer />
          <RouteFacilityLayer />
          <AIResultLayer />
          <LiveBusLayer />
          <SosTrackerLayer />
        </>
      }
      overlays={
        <>
          {isNavigating ? (
            <NavigationHUD onBannerHeightChange={setHudBannerHeight} />
          ) : (
            <View pointerEvents="box-none" style={[styles.pill, { top: insets.top + 8 }]}>
              <EnvironmentChip />
              <RouteSessionPill isNavigating={isNavigating} />
            </View>
          )}
          {/* 離線提示與語音對話膠囊（聊天關著或切回文字時顯示）；導航中放到 HUD 下方，不擋轉向提示。
              `hudBannerHeight` 已含 safe-area top，導航中不用再加 insets.top。 */}
          <View pointerEvents="box-none" style={[styles.voice, { top: isNavigating ? hudBannerHeight + 16 : insets.top + 60 }]}>
            <OfflineBanner message={isNavigating ? t('nativeOfflineNavigating') : undefined} />
            <VoiceFloatingIndicator />
          </View>
          {/* SOS 在導航中也要按得到（行動不便者最可能在路上需要求助）：導航時移到 HUD 下方。
              跟上方「定位／圖層／規劃路線」按鈕欄拉開更大間距，降低誤觸（方案 A，測試人員回饋 2026-10-11）。
              按鈕欄從 2 顆變 3 顆（2026-10-17 加「規劃路線」）後要跟著往下挪一顆的高度，
              不然 SOS 會被按鈕欄最後一顆蓋到（使用者回饋：右上角按鈕疊在一起）。 */}
          <View pointerEvents="box-none" style={[styles.sos, { top: isNavigating ? hudBannerHeight + 106 : insets.top + 280 }]}>
            <SosButton />
          </View>
          {/* 「快速服務」常駐浮在地圖上（2026-10-17 使用者回饋：跟 Google 地圖比，快捷方式被鎖在 sheet
              裡才看得到）；位置固定貼 peek 高度之上（見 `showQuickActionsDock`），不是貼著放，跟
              sheet 頂緣留 32pt 才看得出是「浮在地圖上」而不是黏在 sheet 上。
              右邊界刻意不留白：曾經留 90pt 想避開 SOS，結果變成膠囊捲到底時被這個邊界整顆切掉
              （使用者回饋 2026-10-17：「還是沒有修正右邊被切掉的問題」）。固定貼 peek 高度後跟 SOS
              垂直方向本來就不會疊到（SOS 在按鈕欄下方，y 落點比膠囊列高很多），不需要犧牲捲動範圍；
              最後一顆的留白交給 `QuickActionsDock` 的 `paddingHorizontal` 就夠。 */}
          {showQuickActionsDock ? (
            <View pointerEvents="box-none" style={[styles.quickActionsDock, { bottom: peekInset + 32 }]}>
              <QuickActionsDock />
            </View>
          ) : null}
        </>
      }
    />
  );
}

const styles = StyleSheet.create({
  pill: { position: 'absolute', left: 16, right: 72, alignItems: 'flex-start', gap: 8 },
  // 跟 MapControls（定位／3D）的右邊界對齊——兩處以前差 4pt，三顆在螢幕右側疊成一欄時那條邊看起來沒對齊。
  sos: { position: 'absolute', right: 16 },
  voice: { position: 'absolute', left: 16, right: 80, alignItems: 'flex-start', gap: 8 },
  quickActionsDock: { position: 'absolute', left: 0, right: 0 },
});
