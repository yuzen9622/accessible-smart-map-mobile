import { Camera, Layer, Map, NativeUserLocation } from '@maplibre/maplibre-react-native';
import { router, useFocusEffect, usePathname } from 'expo-router';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Keyboard, StyleSheet, View, useColorScheme } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTranslation } from '@/shared/i18n';
import { getLocationPort } from '@/shared/location';
import { appStorage, readJson } from '@/shared/storage';
import { ErrorState, LoadingState } from '@/shared/ui';

import { SheetEdgeFollower } from '../../../../modules/sheet-detent';
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
import LayerChips from './LayerChips';
import ParkingLayer from './ParkingLayer';
import MapControls from './MapControls';

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
}

export default function MapScreen({ layers, overlays, navigationMode = false }: MapScreenProps) {
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
  const sheetDetentIndex = useMapUiStore((state) => state.sheetDetentIndex);
  const selectedCategories = useFacilityStore((state) => state.selected);
  const toggleCategory = useFacilityStore((state) => state.toggleCategory);
  const showParking = useFacilityStore((state) => state.showParking);
  const toggleParking = useFacilityStore((state) => state.toggleParking);
  // 初始相機只在第一次 render 決定（之後由 mapCamera 控制）
  const [initialCamera] = useState(() =>
    resolveInitialCamera(readJson(appStorage, LAST_USER_LOCATION_KEY, isLatLng, null)),
  );
  const pathname = usePathname();
  // 一次拖曳手勢的起點；拖得夠遠就把 sheet 收到最小（每個手勢只收一次）
  const panStart = useRef<{ sample: ViewportSample; collapsed: boolean } | null>(null);
  useLocationTracking();
  useFacilitiesLoader();

  // 冷啟動第一個真實 GPS fix：置中一次；深層連結或使用者已移動相機時不搶
  useEffect(() => {
    if (position) mapCamera.autoCenterOnce([position.lng, position.lat], LOCATED_ZOOM);
  }, [position]);

  // 常駐 sheet：地圖一露出（上面沒有 sheet）就把首頁 sheet 帶出來。用 focus 而非只在掛載時推一次：
  // 萬一 sheet 被關掉也會自動補回；深層連結已帶 sheet 路由時地圖不在最上層，不會重複推。
  useFocusEffect(() => {
    router.navigate('/explore');
  });

  const handleToggle3d = async () => {
    const next = !is3d;
    toggle3d();
    try {
      await mapCamera.setPitch(next ? MAP_PITCH_3D : 0);
    } catch (error) {
      console.warn('[map] setPitch failed', error);
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
      console.warn('[map] locate failed', error);
    }
  };

  const layerChips = (
    <LayerChips
      label={t('nativeMapLayers')}
      chips={[
        ...(['elevator', 'toilet', 'ramp'] as const).map((category) => ({
          key: category,
          label: t(LAYER_LABEL_KEY[category]),
          selected: selectedCategories.includes(category),
          onToggle: () => toggleCategory(category),
        })),
        { key: 'parking', label: t('railParking'), selected: showParking, onToggle: toggleParking },
      ]}
    />
  );

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
        compass={false}
        onRegionWillChange={(event) => {
          const { userInteraction, center, zoom, bounds } = event.nativeEvent;
          panStart.current = userInteraction ? { sample: { center, zoom, bounds }, collapsed: false } : null;
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
            ? { zoom: follow.zoom, pitch: follow.pitch, padding: { top: 0, left: 0, right: 0, bottom: sheetInset }, duration: 800 }
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
      {/* 圖層 chips 貼在 sheet 上緣（設計 1b）：iOS 由 native view 逐格跟著 sheet（拖曳中也不會跳）並在
          sheet 過半時淡出；Android／舊 dev client 退回依 detent 算出的 inset。只在首頁出現。 */}
      {!navigationMode && pathname === '/explore' ? (
        SheetEdgeFollower ? (
          <SheetEdgeFollower pointerEvents="box-none" gap={4} style={styles.chipsFollower}>
            {layerChips}
          </SheetEdgeFollower>
        ) : sheetDetentIndex <= 1 ? (
          <View pointerEvents="box-none" style={[styles.chips, { bottom: sheetInset + 4 }]}>
            {layerChips}
          </View>
        ) : null
      ) : null}
      {overlays}
      {navigationMode ? null : (
      <View style={[styles.controls, { top: insets.top + 56 }]}>
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
              key: '3d',
              label: is3d ? t('switchTo2D') : t('switchTo3D'),
              systemImage: is3d ? 'map' : 'view.3d',
              shortLabel: is3d ? '2D' : '3D',
              onPress: () => void handleToggle3d(),
            },
          ]}
        />
      </View>
      )}
    </View>
  );
}

const LAYER_LABEL_KEY = { elevator: 'elevator', toilet: 'toilet', ramp: 'a11yFeatureRamp' } as const;

const styles = StyleSheet.create({
  container: { flex: 1 },
  chips: { position: 'absolute', left: 0, right: 0 },
  chipsFollower: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  map: { flex: 1 },
  controls: { position: 'absolute', right: 16 },
});
