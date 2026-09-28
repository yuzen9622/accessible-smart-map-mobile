// Spike A（R2）：maplibre-react-native 在 SDK 57 上的 style、3D 淡化、分群、相機 API 驗證。
// 結論寫在 docs/spikes/map.md；Phase 1 以正式的 features/map 取代本檔。
import {
  Camera,
  GeoJSONSource,
  Layer,
  Map,
  type CameraRef,
  type GeoJSONSourceRef,
} from '@maplibre/maplibre-react-native';
import type { StyleSpecification } from '@maplibre/maplibre-gl-style-spec';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View, useColorScheme } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useThemeColors } from '@/shared/theme';

import { BUILDING_3D_ID, buildingExtrusionPaint, loadBasemapStyle, type MapTheme } from './basemapStyle';
import { loadFacilities, type FacilityLoadResult } from './facilities';
import MapSpikeControls from './MapSpikeControls';

const TAIPEI_MAIN_STATION: [number, number] = [121.5170, 25.0478];
const TAIPEI_101: [number, number] = [121.5645, 25.0340];
const SHEET_PADDING = 320;

export default function MapSpikeScreen() {
  const theme: MapTheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const cameraRef = useRef<CameraRef>(null);
  const sourceRef = useRef<GeoJSONSourceRef>(null);
  const [style, setStyle] = useState<StyleSpecification | null>(null);
  const [facilities, setFacilities] = useState<FacilityLoadResult | null>(null);
  const [is3d, setIs3d] = useState(false);
  const [sheetPadding, setSheetPadding] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  const append = (line: string) => setLog((prev) => [line, ...prev].slice(0, 6));

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const next = await loadBasemapStyle(theme);
        if (!cancelled) setStyle(next);
      } catch (error) {
        if (!cancelled) setLog((prev) => [`style 失敗：${String(error)}`, ...prev]);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [theme]);

  useEffect(() => {
    const controller = new AbortController();
    const run = async () => {
      try {
        const result = await loadFacilities(controller.signal);
        setFacilities(result);
        setLog((prev) => [
          `設施 ${result.collection.features.length} 筆、${(result.bytes / 1024).toFixed(0)} KB、下載 ${result.fetchMs} ms、解析 ${result.parseMs} ms`,
          ...prev,
        ]);
      } catch (error) {
        if (!controller.signal.aborted) {
          setLog((prev) => [`設施失敗：${String(error)}`, ...prev]);
        }
      }
    };
    void run();
    return () => controller.abort();
  }, []);

  const toggle3d = async () => {
    const next = !is3d;
    setIs3d(next);
    append(next ? '3D 開' : '3D 關');
    try {
      await cameraRef.current?.setStop({ pitch: next ? 60 : 0, duration: 600, easing: 'ease' });
    } catch (error) {
      append(`pitch 失敗：${String(error)}`);
    }
  };

  const handleClusterPress = async (clusterId: number, center: [number, number]) => {
    try {
      const zoom = await sourceRef.current?.getClusterExpansionZoom(clusterId);
      if (zoom !== undefined) {
        cameraRef.current?.easeTo({ center, zoom, duration: 500 });
        append(`cluster ${clusterId} → zoom ${zoom}`);
      }
    } catch (error) {
      append(`cluster 失敗：${String(error)}`);
    }
  };

  const padding = { top: insets.top, bottom: sheetPadding ? SHEET_PADDING : 0, left: 0, right: 0 };

  return (
    <View style={styles.container}>
      {style ? (
        <Map style={styles.map} mapStyle={style} logo={false} compass={false}>
          <Camera
            ref={cameraRef}
            initialViewState={{ center: TAIPEI_MAIN_STATION, zoom: 15 }}
            padding={padding}
          />
          <Layer
            id={BUILDING_3D_ID}
            type="fill-extrusion"
            source="openmaptiles"
            source-layer="building"
            minzoom={14}
            filter={['match', ['geometry-type'], ['Polygon', 'MultiPolygon'], true, false]}
            paint={buildingExtrusionPaint(theme, is3d)}
          />
          {facilities ? (
            <GeoJSONSource
              ref={sourceRef}
              id="facilities"
              data={facilities.collection}
              cluster
              clusterRadius={50}
              clusterMaxZoom={16}
              onPress={(event) => {
                const feature = event.nativeEvent.features[0];
                if (!feature || feature.geometry.type !== 'Point') return;
                const [lng, lat] = feature.geometry.coordinates;
                const clusterId = feature.properties?.cluster_id;
                if (typeof clusterId === 'number' && typeof lng === 'number' && typeof lat === 'number') {
                  void handleClusterPress(clusterId, [lng, lat]);
                } else {
                  append(`點擊設施：${String(feature.properties?.name)}`);
                }
              }}>
              <Layer
                id="facility-clusters"
                type="circle"
                filter={['has', 'point_count']}
                paint={{
                  'circle-color': '#208AEF',
                  'circle-radius': ['step', ['get', 'point_count'], 16, 50, 22, 200, 28],
                  'circle-stroke-width': 2,
                  'circle-stroke-color': '#FFFFFF',
                }}
              />
              <Layer
                id="facility-cluster-count"
                type="symbol"
                filter={['has', 'point_count']}
                layout={{
                  'text-field': ['get', 'point_count_abbreviated'],
                  'text-font': ['Noto Sans Regular'],
                  'text-size': 13,
                }}
                paint={{ 'text-color': '#FFFFFF' }}
              />
              <Layer
                id="facility-points"
                type="circle"
                filter={['!', ['has', 'point_count']]}
                paint={{
                  'circle-color': [
                    'match',
                    ['get', 'category'],
                    'elevator',
                    '#2E7D32',
                    'ramp',
                    '#EF6C00',
                    '#6A1B9A',
                  ],
                  'circle-radius': 7,
                  'circle-stroke-width': 2,
                  'circle-stroke-color': '#FFFFFF',
                }}
              />
            </GeoJSONSource>
          ) : null}
        </Map>
      ) : null}

      <View style={[styles.controls, { top: insets.top + 140 }]}>
        <MapSpikeControls
          actions={[
            {
              key: 'sheet',
              label: '開啟 sheet',
              systemImage: 'rectangle.bottomthird.inset.filled',
              onPress: () => router.push('/spikes/sheet'),
            },
            { key: '3d', label: is3d ? '切換 2D' : '切換 3D', systemImage: 'view.3d', onPress: () => void toggle3d() },
            {
              key: 'fly',
              label: '飛到台北 101',
              systemImage: 'airplane',
              onPress: () => {
                cameraRef.current?.flyTo({ center: TAIPEI_101, zoom: 16, padding });
                append('flyTo 101');
              },
            },
            {
              key: 'fit',
              label: '框住兩點',
              systemImage: 'rectangle.dashed',
              onPress: () => {
                cameraRef.current?.fitBounds([121.5170, 25.0340, 121.5645, 25.0478], { duration: 800 });
                append('fitBounds');
              },
            },
            {
              key: 'padding',
              label: sheetPadding ? '移除 sheet padding' : '模擬 sheet padding',
              systemImage: 'rectangle.bottomhalf.filled',
              onPress: () => {
                setSheetPadding((prev) => !prev);
                append(sheetPadding ? 'padding 0' : `padding bottom ${SHEET_PADDING}`);
              },
            },
          ]}
        />
      </View>

      <View style={[styles.log, { bottom: insets.bottom + 12, backgroundColor: colors.background }]}>
        {log.map((line, index) => (
          <Text key={`${index}-${line}`} style={{ color: colors.text, fontSize: 12 }}>
            {line}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  controls: { position: 'absolute', right: 16 },
  log: { position: 'absolute', left: 16, right: 16, padding: 8, borderRadius: 8, opacity: 0.9 },
});
