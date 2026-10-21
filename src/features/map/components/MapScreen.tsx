import { Camera, Layer, Map, NativeUserLocation } from '@maplibre/maplibre-react-native';
import { router, useIsFocused, usePathname } from 'expo-router';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Keyboard, StyleSheet, View, useColorScheme } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
import {
  LAST_USER_LOCATION_KEY,
  LOCATED_ZOOM,
  isLatLng,
  resolveInitialCamera,
} from '../domain/initialCamera';
import { PINNED_FACILITY_CATEGORIES } from '../domain/facilities';
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
import MapLayersBar from './MapLayersBar';
import ParkingLayer from './ParkingLayer';
import MapControls from './MapControls';

/** 導航跟隨時讓給 `NavigationHUD` 頂部橫幅的垂直留白（不含 safe-area top），讓定位點落在橫幅下方，
 * 前方路況留白變多，而不是卡在螢幕中段（使用者回饋 2026-10-11，見下方 padding 註解）。 */
const NAV_FOLLOW_TOP_PADDING = 100;

/** 首頁「停車」圖層開啟時才依位置查附近無障礙停車（`NearbyScreen` 也會各自載入）。 */
function ParkingLoader() {
  useNearbyParking();
  return null;
}

export interface MapScreenProps {
  /** 其他 feature 的地圖圖層（設施點、搜尋 pin…），由 app 路由組裝 */
  layers?: ReactNode;
  /** 疊在地圖上的 RN 控制（路線 pill、導航 HUD），由 app 路由組裝；以絕對定位自行擺放 */
  overlays?: ReactNode;
  /** 導航中：隱藏一般浮動按鈕（HUD 有自己的控制），點地圖也不開地點面板 */
  navigationMode?: boolean;
  /**
   * false 時不帶出首頁 sheet（例：首次啟動要先顯示 onboarding）。sheet 與 fullScreenModal 同時 present
   * 會讓 sheet 疊在 modal 之上、擋住其按鈕；改回 true 後地圖重新 focus 時才帶出。
   */
  homeSheetEnabled?: boolean;
}

export default function MapScreen({ layers, overlays, navigationMode = false, homeSheetEnabled = true }: MapScreenProps) {
  const theme: MapTheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const { t } = useAppTranslation();
  const insets = useSafeAreaInsets();
  const [reloadKey, setReloadKey] = useState(0);
  const basemap = useBasemapStyle(theme, reloadKey);
  const is3d = useMapUiStore((state) => state.is3d);
  const toggle3d = useMapUiStore((state) => state.toggle3d);
  const permission = useUserLocationStore((state) => state.permission);
  const setPermission = useUserLocationStore((state) => state.setPermission);
  const position = useUserLocationStore((state) => state.position);
  const follow = useMapUiStore((state) => state.follow);
  const sheetInset = useMapUiStore((state) => state.sheetInset);
  const showParking = useFacilityStore((state) => state.showParking);
  const selectedCategories = useFacilityStore((state) => state.selected);
  const toggleCategory = useFacilityStore((state) => state.toggleCategory);
  const toggleParking = useFacilityStore((state) => state.toggleParking);
  // 初始相機只在第一次 render 決定（之後由 mapCamera 控制）
  const [initialCamera] = useState(() =>
    resolveInitialCamera(readJson(appStorage, LAST_USER_LOCATION_KEY, isLatLng, null)),
  );
  const pathname = usePathname();
  // 一次拖曳手勢的起點；拖得夠遠就把 sheet 收到最小（每個手勢只收一次）
  const panStart = useRef<{ sample: ViewportSample; collapsed: boolean } | null>(null);
  // 使用者正在拖曳／縮放地圖時，淡出非必要的浮動控制（篩選 chips、定位/3D/篩選鈕），
  // 讓地圖在操作當下盡量乾淨；放開後淡回。SOS、路線膠囊等安全／狀態相關資訊不淡出。
  const [controlsOpacity] = useState(() => new Animated.Value(1));
  const fadeControls = (toValue: number) => {
    Animated.timing(controlsOpacity, { toValue, duration: 160, useNativeDriver: true }).start();
  };
  useLocationTracking();
  useFacilitiesLoader();

  // 冷啟動第一個真實 GPS fix：置中一次；深層連結或使用者已移動相機時不搶
  useEffect(() => {
    if (position) mapCamera.autoCenterOnce([position.lng, position.lat], LOCATED_ZOOM);
  }, [position]);

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
      await mapCamera.setPitch(next ? MAP_PITCH_3D : 0);
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
      const current = position ?? (await port.getCurrent({ accuracy: 'high' }));
      mapCamera.flyTo([current.lng, current.lat], LOCATED_ZOOM);
    } catch (error) {
      logger.warn('[map] locate failed', error);
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
          useMapUiStore.getState().setZoom(event.nativeEvent.zoom);
        }}
        onPress={(event) => {
          if (navigationMode) return;
          // 點地圖空白處：以座標開地點面板（反查地址）；點到設施時 FacilityLayer 已 stopPropagation
          const [lng, lat] = event.nativeEvent.lngLat;
          const target = { pathname: '/loc/[coords]', params: { coords: `${lat},${lng}` } } as const;
          // 已在看地點／設施詳情時換成新的點（像 Apple 地圖換卡片），不要一路疊頁面
          if (isPlaceDetailPath(pathname)) router.replace(target);
          else router.navigate(target);
        }}>
        <Camera
          ref={registerMapCamera}
          initialViewState={{
            center: [initialCamera.center.lng, initialCamera.center.lat],
            zoom: initialCamera.zoom,
            pitch: is3d ? MAP_PITCH_3D : 0,
          }}
          trackUserLocation={follow?.mode}
          {...(follow
            ? {
                zoom: follow.zoom,
                pitch: follow.pitch,
                // 導航中：原生 trackUserLocation 把定位點放在 padding box 的垂直中心；top 不留白時
                // 定位點會卡在 HUD 橫幅下緣附近，畫面可視範圍大半被「後方」佔走，看不到前方轉彎
                // （使用者回饋 2026-10-11）。導航時把 top 讓出 HUD 橫幅高度，定位點才會往下挪、
                // 前方路況留白變多；非導航時仍是 0，不影響一般瀏覽地圖。
                padding: { top: navigationMode ? insets.top + NAV_FOLLOW_TOP_PADDING : 0, left: 0, right: 0, bottom: sheetInset },
                duration: 800,
              }
            : {})}
          onTrackUserLocationChange={(event) => {
            // 使用者拖曳地圖時原生會解除追蹤：記下「被打斷」，讓導航顯示「回到導航」
            if (event.nativeEvent.trackUserLocation === null && useMapUiStore.getState().follow) {
              useMapUiStore.getState().setFollow(null);
              useMapUiStore.getState().setFollowInterrupted(true);
            }
          }}
        />
        <Layer
          id={BUILDING_3D_LAYER_ID}
          type="fill-extrusion"
          source={BASEMAP_SOURCE_ID}
          source-layer="building"
          minzoom={14}
          filter={['match', ['geometry-type'], ['Polygon', 'MultiPolygon'], true, false]}
          paint={buildingExtrusionPaint(theme, is3d)}
        />
        <FacilityLayer />
        {navigationMode ? null : <FacilityPills />}
        {showParking || pathname === '/nearby' ? <ParkingLayer /> : null}
        {layers}
        {permission === 'granted' ? <NativeUserLocation mode="heading" /> : null}
      </Map>
      {showParking ? <ParkingLoader /> : null}
      {overlays}
      {navigationMode ? null : (
      <Animated.View style={[styles.controls, { top: insets.top + 56, opacity: controlsOpacity }]}>
        <MapControls
          actions={[
            {
              key: 'locate',
              label: t('shortcutMyLocation'),
              systemImage: 'location.fill',
              shortLabel: '◎',
              onPress: () => void handleLocate(),
            },
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
      {/* 設施篩選常駐貼在 sheet 上緣（使用者回饋：右邊「圖層」按鈕/彈出卡片不需要了，改成像搜尋框
          上方那排一樣直接看得到、點得到，不用先點開）。 */}
      {navigationMode ? null : (
        <Animated.View
          pointerEvents="box-none"
          style={[styles.facilityBar, { bottom: sheetInset + 12, opacity: controlsOpacity }]}>
          <MapLayersBar
            facilityToggles={[
              ...PINNED_FACILITY_CATEGORIES.map((category) => ({
                key: category as string,
                label: t(LAYER_LABEL_KEY[category]),
                iconName: category,
                systemImage: LAYER_SYSTEM_IMAGE[category],
                selected: selectedCategories.includes(category),
                onToggle: () => toggleCategory(category),
              })),
              {
                key: 'parking',
                label: t('railParking'),
                iconName: 'parking',
                systemImage: 'parkingsign.square.fill',
                selected: showParking,
                onToggle: toggleParking,
              },
            ]}
          />
        </Animated.View>
      )}
    </View>
  );
}

const LAYER_LABEL_KEY = { elevator: 'elevator', toilet: 'toilet', ramp: 'a11yFeatureRamp' } as const;
const LAYER_SYSTEM_IMAGE = {
  elevator: 'arrow.up.arrow.down.square.fill',
  toilet: 'toilet.fill',
  ramp: 'figure.roll',
} as const;

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  controls: { position: 'absolute', right: 16 },
  facilityBar: { position: 'absolute', left: 16, right: 16 },
});
