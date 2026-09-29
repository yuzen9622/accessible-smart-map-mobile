import { Camera, Layer, Map, NativeUserLocation } from '@maplibre/maplibre-react-native';
import { router, usePathname } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, View, useColorScheme } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTranslation } from '@/shared/i18n';
import { getLocationPort } from '@/shared/location';
import { appStorage, readJson } from '@/shared/storage';
import { ErrorState, LoadingState } from '@/shared/ui';

import { mapCamera, registerMapCamera } from '../controller/mapCamera';
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
import { isPlaceDetailPath } from '../domain/sheetInset';
import { useMapUiStore } from '../store/mapUiStore';
import { useUserLocationStore } from '../store/userLocationStore';
import FacilityLayer from './FacilityLayer';
import ParkingLayer from './ParkingLayer';
import MapControls from './MapControls';

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
  // 初始相機只在第一次 render 決定（之後由 mapCamera 控制）
  const [initialCamera] = useState(() =>
    resolveInitialCamera(readJson(appStorage, LAST_USER_LOCATION_KEY, isLatLng, null)),
  );
  const pathname = usePathname();
  useLocationTracking();
  useFacilitiesLoader();

  // 冷啟動第一個真實 GPS fix：置中一次；深層連結或使用者已移動相機時不搶
  useEffect(() => {
    if (position) mapCamera.autoCenterOnce([position.lng, position.lat], LOCATED_ZOOM);
  }, [position]);

  // 常駐 sheet：進到地圖就把 sheet 帶出來（深層連結已帶 sheet 路由時 router 會保留它）
  useEffect(() => {
    router.push('/explore');
  }, []);

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
        onPress={(event) => {
          if (navigationMode) return;
          // 點地圖空白處：以座標開地點面板（反查地址）；點到設施時 FacilityLayer 已 stopPropagation
          const [lng, lat] = event.nativeEvent.lngLat;
          const target = { pathname: '/loc/[coords]', params: { coords: `${lat},${lng}` } } as const;
          // 已在看地點／設施詳情時換成新的點（像 Apple 地圖換卡片），不要一路疊頁面
          if (isPlaceDetailPath(pathname)) router.replace(target);
          else router.push(target);
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
        <ParkingLayer />
        {layers}
        {permission === 'granted' ? <NativeUserLocation mode="heading" /> : null}
      </Map>
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

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  controls: { position: 'absolute', right: 16 },
});
