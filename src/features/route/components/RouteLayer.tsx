import type { CircleLayerSpecification, GeoJSONSourceProps, LineLayerSpecification } from '@maplibre/maplibre-react-native';
import { GeoJSONSource, Layer } from '@maplibre/maplibre-react-native';
import type { Feature, Point } from 'geojson';
import { memo, useCallback, useMemo } from 'react';
import { useColorScheme } from 'react-native';

import { selectRouteAt } from '../controller/routeSessionPort';
import { ROUTE_DESTINATION_COLOR, buildAlternativeRouteLines, buildRouteLayerData, type RoutePointProps } from '../domain/routeLayerData';
import { createRouteReveal } from '../domain/routeReveal';
import { useRouteReveal } from '../hooks/useRouteReveal';
import { useRouteSessionStore } from '../store/routeSessionStore';
import { ROUTE_ALTERNATIVE, ROUTE_STROKE, WHITE } from '@/shared/theme';

/**
 * 路線圖層：所有運具使用實色內線與同色系外框，步行依人行道分類使用藍／綠線。
 * 顏色由 feature 屬性決定。點（起訖點、轉乘、中繼站、事故、點狀設施）共用一個 circle layer。
 *
 * 只有目的地、還沒算出路線時也畫目的地 pin（對齊 `hasRouteSession` 的定義：它也需要 pill 當出口）。
 */
/** 全運具共用；traffic 的外框與內線另疊在底線上，保持路況顏色完整。 */
export const ROUTE_CASING_PAINT: LineLayerSpecification['paint'] = {
  'line-color': ['coalesce', ['get', 'casing'], WHITE],
  'line-width': ROUTE_STROKE.casingWidth,
};

export const ROUTE_LINE_PAINT: LineLayerSpecification['paint'] = {
  'line-color': ['get', 'color'],
  'line-width': ROUTE_STROKE.lineWidth,
};

/**
 * 點的填色與外框。轉乘點預設白心、線色外框；捷運線色表內的線（feature 帶 `casing`）改線色實心、`casing` 外框，
 * 黃線才不會變成白底上看不見的黃圈。起點維持白心、線色外框，其餘點線色實心、白框。
 */
export const ROUTE_POINT_COLOR_PAINT: Pick<NonNullable<CircleLayerSpecification['paint']>, 'circle-color' | 'circle-stroke-color'> = {
  'circle-color': [
    'match',
    ['get', 'kind'],
    'origin',
    WHITE,
    'transfer',
    ['case', ['has', 'casing'], ['get', 'color'], WHITE],
    ['get', 'color'],
  ],
  'circle-stroke-color': [
    'match',
    ['get', 'kind'],
    'origin',
    ['get', 'color'],
    'transfer',
    ['coalesce', ['get', 'casing'], ['get', 'color']],
    WHITE,
  ],
};

// GeoJSONSource 會注入 source；固定樣式不隨每幀的幾何更新重新轉換。
const RouteLineLayers = memo(function RouteLineLayers({ source }: { source?: string }) {
  return (
    <>
      <Layer
        source={source}
        id="route-line-casing"
        type="line"
        filter={['match', ['get', 'kind'], ['walk', 'sidewalk', 'transit', 'drive'], true, false]}
        layout={{ 'line-cap': 'round', 'line-join': 'round' }}
        paint={ROUTE_CASING_PAINT}
      />
      <Layer
        source={source}
        id="route-line-solid"
        type="line"
        filter={['match', ['get', 'kind'], ['walk', 'sidewalk', 'transit', 'drive'], true, false]}
        layout={{ 'line-cap': 'round', 'line-join': 'round' }}
        paint={ROUTE_LINE_PAINT}
      />
      <Layer
        source={source}
        id="route-line-traffic-casing"
        type="line"
        filter={['==', ['get', 'kind'], 'traffic']}
        layout={{ 'line-cap': 'round', 'line-join': 'round', 'line-sort-key': ['get', 'order'] }}
        paint={ROUTE_CASING_PAINT}
      />
      <Layer
        source={source}
        id="route-line-traffic"
        type="line"
        filter={['==', ['get', 'kind'], 'traffic']}
        layout={{ 'line-cap': 'round', 'line-join': 'round', 'line-sort-key': ['get', 'order'] }}
        paint={ROUTE_LINE_PAINT}
      />
      <Layer
        source={source}
        id="route-line-incident"
        type="line"
        filter={['==', ['get', 'kind'], 'incident']}
        layout={{ 'line-cap': 'round', 'line-join': 'round' }}
        paint={{ 'line-color': ['get', 'color'], 'line-width': 5, 'line-opacity': 0.9, 'line-dasharray': [1, 1.5] }}
      />
    </>
  );
});

const ROUTE_LINE_LAYERS = <RouteLineLayers />;
const stopRoutePress: GeoJSONSourceProps['onPress'] = (event) => event.stopPropagation();
const ROUTE_POINT_LAYER = (
  <Layer
    id="route-point-circles"
    type="circle"
    paint={{
      ...ROUTE_POINT_COLOR_PAINT,
      'circle-radius': [
        'match',
        ['get', 'kind'],
        'destination',
        10,
        'origin',
        8,
        'transfer',
        7,
        'a11yDot',
        6,
        8,
      ],
      'circle-stroke-width': ['match', ['get', 'kind'], ['origin', 'transfer'], 3.5, 2],
    }}
  />
);

export default function RouteLayer({ showAlternatives = true }: { showAlternatives?: boolean }) {
  const selected = useRouteSessionStore((s) => s.selectRoute?.route ?? null);
  const routes = useRouteSessionStore((s) => s.computeRoutes);
  const travelMode = useRouteSessionStore((s) => s.effectivePreferences?.travelMode ?? s.travelMode);
  const theme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const alternativeColor = ROUTE_ALTERNATIVE[theme];
  const alternatives = useMemo(() => buildAlternativeRouteLines(
    showAlternatives ? routes : null, selected?.routeId ?? null, travelMode,
  ), [routes, selected?.routeId, travelMode, showAlternatives]);
  const onAlternativePress = useCallback<NonNullable<GeoJSONSourceProps['onPress']>>((event) => {
    event.stopPropagation();
    const routeId = event.nativeEvent.features[0]?.properties?.routeId;
    if (typeof routeId !== 'string' || !alternatives.features.some((feature) => feature.properties.routeId === routeId)) return;
    const index = useRouteSessionStore.getState().computeRoutes?.findIndex((route) => route.routeId === routeId) ?? -1;
    if (index >= 0) selectRouteAt(index);
  }, [alternatives]);
  const alternativeLayers = useMemo(() => [
    <Layer key="casing" id="route-alternative-casing" type="line" beforeId="route-line-casing"
      layout={{ 'line-cap': 'round', 'line-join': 'round' }}
      paint={{ 'line-color': alternativeColor.casing, 'line-width': ROUTE_STROKE.casingWidth }} />,
    <Layer key="line" id="route-alternative-line" type="line" beforeId="route-line-casing"
      layout={{ 'line-cap': 'round', 'line-join': 'round' }}
      paint={{ 'line-color': alternativeColor.line, 'line-width': ROUTE_STROKE.lineWidth }} />,
  ], [alternativeColor]);
  const preview = useRouteSessionStore((s) => s.legGeometryPreview);
  // 查看別班公車時，那段 leg 改畫那班的線形（只在這張圖層上替換，不寫回路線）
  const route = useMemo(() => {
    const previewLeg = preview && selected?.routeId === preview.routeId ? selected.legs[preview.legIndex] : undefined;
    return selected && preview && previewLeg?.type === 'BUS'
      ? { ...selected, legs: selected.legs.map((leg, index) => (index === preview.legIndex ? { ...previewLeg, polyline: preview.polyline } : leg)) }
      : selected;
  }, [selected, preview]);
  const waypoints = useRouteSessionStore((s) => s.routeWaypoints);
  const destination = useRouteSessionStore((s) => s.destination);

  const reveal = useRouteReveal(route?.routeId ?? null);
  const data = useMemo(() => {
    const result = buildRouteLayerData(route, waypoints);
    if (!route && destination) {
      const pin: Feature<Point, RoutePointProps> = {
        type: 'Feature',
        id: 'destination',
        geometry: { type: 'Point', coordinates: [destination.lng, destination.lat] },
        properties: { id: 'destination', kind: 'destination', color: ROUTE_DESTINATION_COLOR },
      };
      return { ...result, points: { ...result.points, features: [pin] } };
    }
    return result;
  }, [route, waypoints, destination]);
  const revealLines = useMemo(() => createRouteReveal(data.lines), [data.lines]);
  // 繪出動畫期間只畫到進度位置；起點之外的點（轉乘、中繼、事故）等畫完再出現
  const lines = revealLines(reveal);
  const complete = reveal >= 1;
  const points = useMemo(() => complete ? data.points : {
    ...data.points, features: data.points.features.filter((f) => f.properties.kind === 'origin'),
  }, [data.points, complete]);
  if (data.lines.features.length === 0 && data.points.features.length === 0 && alternatives.features.length === 0) return null;

  return (
    <>
      {alternatives.features.length > 0 ? (
        <GeoJSONSource id="route-alternatives" data={alternatives} onPress={onAlternativePress}>
          {alternativeLayers}
        </GeoJSONSource>
      ) : null}
      <GeoJSONSource id="route-lines" data={lines} onPress={stopRoutePress}>
        {ROUTE_LINE_LAYERS}
      </GeoJSONSource>
      <GeoJSONSource id="route-points" data={points}>
        {ROUTE_POINT_LAYER}
      </GeoJSONSource>
    </>
  );
}
