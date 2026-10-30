import { Camera, Layer, Map, NativeUserLocation, type MapRef, type PressEvent } from '@maplibre/maplibre-react-native';
import type { StyleSpecification } from '@maplibre/maplibre-gl-style-spec';
import { router, useIsFocused, usePathname } from 'expo-router';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Keyboard, StyleSheet, View, useColorScheme, type NativeSyntheticEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { haptic } from '@/shared/haptics';
import { useAppTranslation } from '@/shared/i18n';
import { getLocationPort } from '@/shared/location';
import { logger } from '@/shared/logger';
import { appStorage, readJson } from '@/shared/storage';
import { ErrorState, LoadingState } from '@/shared/ui';
import { useSplashStore } from '@/shared/ui/splashStore';

import { mapCamera, registerMapCamera } from '../controller/mapCamera';
import { sheetController } from '../controller/sheetController';
import {
  BASEMAP_SOURCE_ID,
  BUILDING_3D_LAYER_ID,
  MAP_PITCH_3D,
  buildingExtrusionPaint,
  type MapTheme,
} from '../domain/basemap';
import { BASEMAP_POI_LAYER_IDS, POI_HIT_SLOP, pickPoiHit } from '../domain/basemapPoi';
import {
  LAST_USER_LOCATION_KEY,
  LOCATED_ZOOM,
  isLatLng,
  resolveInitialCamera,
} from '../domain/initialCamera';
import { useBasemapStyle } from '../hooks/useBasemapStyle';
import { useFacilitiesLoader } from '../hooks/useFacilitiesLoader';
import { useLocationTracking } from '../hooks/useLocationTracking';
import { useNearbyParking } from '../hooks/useNearbyParking';
import { shouldCollapseForPan, type ViewportSample } from '../domain/panCollapse';
import { isPlaceDetailPath } from '../domain/sheetInset';
import { useFacilityStore } from '../store/facilityStore';
import { useMapUiStore } from '../store/mapUiStore';
import { useUserLocationStore } from '../store/userLocationStore';
import FacilityLayer from './FacilityLayer';
import FacilityPills from './FacilityPills';
import ParkingLayer from './ParkingLayer';
import MapControls from './MapControls';
import type { MapControlAction } from './MapControls.types';
import { MOTION } from '@/shared/theme/motion';

/** 首頁「停車」圖層開啟時才依位置查附近無障礙停車（`NearbyScreen` 也會各自載入）。 */
function ParkingLoader() {
  useNearbyParking();
  return null;
}

export interface MapScreenProps {
  /** 其他 feature 的地圖圖層（設施點、搜尋 pin…），由 app 路由組裝 */
  layers?: ReactNode | ((style: StyleSpecification) => ReactNode);
  /** 疊在地圖上的 RN 控制（路線 pill、導航 HUD），由 app 路由組裝；以絕對定位自行擺放 */
  overlays?: ReactNode;
  /** 導航中：隱藏一般浮動按鈕（HUD 有自己的控制），點地圖也不開地點面板 */
  navigationMode?: boolean;
  /**
   * false 時不帶出首頁 sheet（例：首次啟動要先顯示 onboarding）。sheet 與 fullScreenModal 同時 present
   * 會讓 sheet 疊在 modal 之上、擋住其按鈕；改回 true 後地圖重新 focus 時才帶出。
   */
  homeSheetEnabled?: boolean;
  /**
   * false 時不畫「使用者目前位置附近」常駐設施圖層（`FacilityLayer`）：有路線 session 時 app 路由會
   * 透過 `layers` 插入 route feature 自己的 `RouteFacilityLayer`（沿路線 100 公尺內的設施，獨立一個
   * clustered source）；兩個圖層各自 cluster、互不知道對方，同一個設施點會在路線起訖點附近各畫一次，
   * 疊成好幾顆圖示擠在一起而不是合併成一顆數字徽章（使用者回饋 2026-10-23：規劃路線的設施顯示太醜了
   * 好多馬桶）。有路線時交給 `RouteFacilityLayer` 顯示，常駐圖層讓出。
   */
  facilityLayerEnabled?: boolean;
  /** 室內等獨立地圖內容可關閉底圖建物、POI 與 GPS 藍點，避免表示錯誤樓層位置。 */
  baseContextEnabled?: boolean;
  buildingExtrusionEnabled?: boolean;
  /** 由畫面內容指定斜視角度，保留同一個 2D/3D 控制。 */
  perspectivePitch?: number;
}

export default function MapScreen({
  layers,
  overlays,
  navigationMode = false,
  homeSheetEnabled = true,
  facilityLayerEnabled = true,
  baseContextEnabled = true,
  buildingExtrusionEnabled = true,
  perspectivePitch = MAP_PITCH_3D,
}: MapScreenProps) {
  const theme: MapTheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const { t } = useAppTranslation();
  const insets = useSafeAreaInsets();
  const [reloadKey, setReloadKey] = useState(0);
  const basemap = useBasemapStyle(theme, reloadKey);
  const is3d = useMapUiStore((state) => state.is3d);
  const toggle3d = useMapUiStore((state) => state.toggle3d);
  const permission = useUserLocationStore((state) => state.permission);
  const setPermission = useUserLocationStore((state) => state.setPermission);
  const setPosition = useUserLocationStore((state) => state.setPosition);
  const follow = useMapUiStore((state) => state.follow);
  const sheetInset = useMapUiStore((state) => state.sheetInset);
  const showParking = useFacilityStore((state) => state.showParking);
  // 初始相機只在第一次 render 決定（之後由 mapCamera 控制）
  const [initialCamera] = useState(() =>
    resolveInitialCamera(readJson(appStorage, LAST_USER_LOCATION_KEY, isLatLng, null)),
  );
  const pathname = usePathname();
  const mapRef = useRef<MapRef>(null);
  // 一次拖曳手勢的起點；拖得夠遠就把 sheet 收到最小（每個手勢只收一次）
  const panStart = useRef<{ sample: ViewportSample; collapsed: boolean } | null>(null);
  // 使用者正在拖曳／縮放地圖時，淡出非必要的浮動控制（篩選 chips、定位/3D/篩選鈕），
  // 讓地圖在操作當下盡量乾淨；放開後淡回。SOS、路線膠囊等安全／狀態相關資訊不淡出。
  const [controlsOpacity] = useState(() => new Animated.Value(1));
  const fadeControls = (toValue: number) => {
    Animated.timing(controlsOpacity, { toValue, duration: MOTION.small.duration, useNativeDriver: true }).start();
  };
  useLocationTracking();
  useFacilitiesLoader();

  // 冷啟動第一個真實 GPS fix：置中一次；深層連結或使用者已移動相機時不搶。
  // 不要用 `useUserLocationStore((s) => s.position)` 訂閱：GPS 每秒／每移動 2 公尺更新一次，
  // 若當成 render 依賴，MapScreen（連同所有設施圖層／pill）就會跟著重新 render，疊加拖曳手勢
  // 本身的負擔，造成滑動地圖時卡頓（使用者回饋 2026-10-25）。改用 store 自己的 `subscribe`，
  // 在 React render 循環之外監看，拿到第一個位置、`autoCenterOnce` 內部自己的 `claimed`
  // 旗標處理「只置中一次」後就不用再管了。
  useEffect(() => {
    const current = useUserLocationStore.getState().position;
    if (current) mapCamera.autoCenterOnce([current.lng, current.lat], LOCATED_ZOOM);
    return useUserLocationStore.subscribe((state) => {
      if (state.position) mapCamera.autoCenterOnce([state.position.lng, state.position.lat], LOCATED_ZOOM);
    });
  }, []);

  // 常駐 sheet：地圖一露出（上面沒有 sheet）就把首頁 sheet 帶出來。用 focus 而非只在掛載時推一次：
  // 萬一 sheet 被關掉也會自動補回；深層連結已帶 sheet 路由時地圖不在最上層，不會重複推。
  // 等 `SplashIntro` 淡出動畫跑完才 navigate：避免 sheet 在 splash 蓋著畫面時就先滑上來，
  // splash 淡出後才「看到」sheet 已經彈好的突兀感（使用者回饋 2026-10-15）。
  const focused = useIsFocused();
  const splashDone = useSplashStore((state) => state.done);
  useEffect(() => {
    if (focused && splashDone && homeSheetEnabled) router.navigate(navigationMode ? '/navigation' : '/explore');
  }, [focused, splashDone, homeSheetEnabled, navigationMode]);

  const handleToggle3d = async () => {
    const next = !is3d;
    toggle3d();
    try {
      await mapCamera.setPitch(next ? perspectivePitch : 0);
    } catch (error) {
      logger.warn('[map] setPitch failed', error);
    }
  };

  const handleLocate = async () => {
    try {
      const port = getLocationPort();
      const status = await port.requestForegroundPermission();
      setPermission(status);
      if (status !== 'granted') return;
      // 按下去先用 store 裡現有的位置立刻飛一次：使用者要馬上看到反應，不能整個等一輪新的
      // GPS fix（可能要 1～3 秒）才開始動，不然會感覺像按了沒反應（使用者回饋 2026-10-25：
      // 定位按鈕回應慢）。`useLocationTracking` 本來就以 1Hz／2 公尺持續更新這個 store，通常
      // 夠新。等真正拿到新的高精度定位後再飛一次修正——兩次都是同一個 `flyTo`，第二次若
      // 位置幾乎沒變就只是極小幅調整，不會又跳回「舊位置」（原本這段要解決的問題）。
      const cached = useUserLocationStore.getState().position;
      if (cached) mapCamera.flyTo([cached.lng, cached.lat], LOCATED_ZOOM);
      const current = await port.getCurrent({ accuracy: 'high' });
      setPosition(current);
      mapCamera.flyTo([current.lng, current.lat], LOCATED_ZOOM);
    } catch (error) {
      logger.warn('[map] locate failed', error);
    }
  };

  // 已在看地點／設施詳情時換成新的點（像 Apple 地圖換卡片），不要一路疊頁面
  const openPlaceSheet = (
    target:
      | { pathname: '/place/[id]'; params: { id: string } }
      | { pathname: '/loc/[coords]'; params: { coords: string } },
  ) => {
    if (isPlaceDetailPath(pathname)) router.replace(target);
    else router.navigate(target);
  };

  // 單點只開底圖上「目前畫出來」的店家／景點 POI；空白處、道路、建物不反應（點到設施時 FacilityLayer
  // 已 stopPropagation）。任意位置改由長按開座標面板。
  const handlePress = async (event: NativeSyntheticEvent<PressEvent>) => {
    if (navigationMode || !baseContextEnabled) return;
    const { point, lngLat } = event.nativeEvent;
    const [x, y] = point;
    try {
      const features = await mapRef.current?.queryRenderedFeatures(
        [
          [x - POI_HIT_SLOP, y - POI_HIT_SLOP],
          [x + POI_HIT_SLOP, y + POI_HIT_SLOP],
        ],
        { layers: [...BASEMAP_POI_LAYER_IDS] },
      );
      const hit = pickPoiHit(features ?? [], { lng: lngLat[0], lat: lngLat[1] });      if (!hit) return;
      if (hit.placeId) {
        openPlaceSheet({ pathname: '/place/[id]', params: { id: hit.placeId } });
      } else {
        openPlaceSheet({ pathname: '/loc/[coords]', params: { coords: `${hit.position.lat},${hit.position.lng}` } });
      }
    } catch (error) {
      logger.warn('[map] POI query failed', error);
    }
  };

  if (basemap.status === 'loading') {
    return <LoadingState />;
  }
  if (basemap.status === 'error') {
    return (
      <ErrorState
        title={t('nativeMapLoadFailed')}
        description={basemap.error}
        retry={{ label: t('retry'), onPress: () => setReloadKey((key) => key + 1) }}
      />
    );
  }

  return (
    <View style={styles.container}>
      <Map
        ref={mapRef}
        style={styles.map}
        mapStyle={basemap.style}
        logo={false}
        // 一般瀏覽不需要指南針（地圖預設朝北，不會旋轉）；導航中鏡頭會跟著行進方向轉動，
        // 朝向不再直觀，需要指南針才看得出「北」在哪（使用者回饋，參考 Google 地圖導航畫面）。
        // 貼在收合列上緣（用 sheetInset 定位，跟設施篩選列同一招），不擋 HUD 橫幅與轉彎指示。
        compass={navigationMode}
        compassPosition={{ bottom: sheetInset + 16, right: 16 }}
        compassHiddenFacingNorth={false}
        onRegionWillChange={(event) => {
          const { userInteraction, center, zoom, bounds } = event.nativeEvent;
          panStart.current = userInteraction ? { sample: { center, zoom, bounds }, collapsed: false } : null;
          if (userInteraction) fadeControls(0.25);
        }}
        onRegionIsChanging={(event) => {
          const start = panStart.current;
          if (!start || start.collapsed || !event.nativeEvent.userInteraction) return;
          const { center, zoom, bounds } = event.nativeEvent;
          if (!shouldCollapseForPan(start.sample, { center, zoom, bounds })) return;
          // Apple 地圖：往地圖探索時卡片讓位、鍵盤收起；導航中則收回只剩行程列
          start.collapsed = true;
          Keyboard.dismiss();
          sheetController.collapse();
        }}
        onRegionDidChange={(event) => {
          panStart.current = null;
          fadeControls(1);
          const { zoom, bounds, center, userInteraction } = event.nativeEvent;
          useMapUiStore.getState().setZoom(zoom);
          useMapUiStore.getState().setRegion(bounds, center, userInteraction);
        }}
        onPress={(event) => void handlePress(event)}
        onLongPress={(event) => {
          if (navigationMode || !baseContextEnabled) return;
          // 長按任意處：以座標開地點面板（反查地址），同 Apple／Google 地圖的「放置大頭針」
          haptic.select();
          const [lng, lat] = event.nativeEvent.lngLat;
          openPlaceSheet({ pathname: '/loc/[coords]', params: { coords: `${lat},${lng}` } });
        }}>
        <Camera
          ref={registerMapCamera}
          initialViewState={{
            center: [initialCamera.center.lng, initialCamera.center.lat],
            zoom: initialCamera.zoom,
            pitch: is3d ? perspectivePitch : 0,
          }}
          trackUserLocation={follow?.mode}
          // 跟隨中只帶 zoom／pitch：原生追蹤每個定位點都用 1 秒動畫把相機移到使用者，定位點則固定畫在
          // 畫面中心；任何 stop prop 變動都會讓原生以動畫中途的相機 `setCamera`、取消那段動畫，相機停在
          // 半路、定位點卻仍在中心，看起來就是定位飄移。padding 在追蹤模式本來就不會套用，卻會隨 sheet
          // 高度一直變，所以不放進來。
          {...(follow ? { zoom: follow.zoom, pitch: follow.pitch } : {})}
          onTrackUserLocationChange={(event) => {
            // 使用者拖曳地圖時原生會解除追蹤：記下「被打斷」，讓導航顯示「回到導航」
            if (event.nativeEvent.trackUserLocation === null && useMapUiStore.getState().follow) {
              useMapUiStore.getState().setFollow(null);
              useMapUiStore.getState().setFollowInterrupted(true);
            }
          }}
        />
        {baseContextEnabled && buildingExtrusionEnabled ? <Layer
          id={BUILDING_3D_LAYER_ID}
          type="fill-extrusion"
          source={BASEMAP_SOURCE_ID}
          source-layer="building"
          minzoom={14}
          filter={['match', ['geometry-type'], ['Polygon', 'MultiPolygon'], true, false]}
          paint={buildingExtrusionPaint(theme, is3d)}
        /> : null}
        {facilityLayerEnabled ? <FacilityLayer /> : null}
        {navigationMode || !baseContextEnabled ? null : <FacilityPills />}
        {baseContextEnabled && (showParking || pathname === '/nearby') ? <ParkingLayer /> : null}
        {typeof layers === 'function' ? layers(basemap.style) : layers}
        {baseContextEnabled && permission === 'granted' ? <NativeUserLocation mode="heading" /> : null}
      </Map>
      {showParking ? <ParkingLoader /> : null}
      {overlays}
      {navigationMode ? null : (
      <Animated.View style={[styles.controls, { top: insets.top + 56, opacity: controlsOpacity }]}>
        <MapControls
          actions={[
            ...(baseContextEnabled ? [{
              key: 'locate',
              label: t('shortcutMyLocation'),
              systemImage: 'location.fill',
              shortLabel: '◎',
              onPress: () => void handleLocate(),
            } satisfies MapControlAction] : []),
            {
              // 2D／3D 跟設施圖層篩選放在同一排圖示時使用者分不出哪顆在控制視角（使用者回饋：那排
              // 圖示長得都一樣，圈起來那顆其實只是在切 2D／3D）；獨立成自己的常駐按鈕。
              key: 'toggle3d',
              label: is3d ? t('switchTo2D') : t('switchTo3D'),
              systemImage: 'cube',
              shortLabel: is3d ? '2D' : '3D',
              onPress: () => void handleToggle3d(),
            },
          ]}
        />
      </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  controls: { position: 'absolute', right: 16 },
});
