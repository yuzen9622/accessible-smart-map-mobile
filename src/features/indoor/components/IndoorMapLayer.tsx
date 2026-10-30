import { GeoJSONSource, Layer, Marker, type GeoJSONSourceProps } from '@maplibre/maplibre-react-native';
import type { StyleSpecification } from '@maplibre/maplibre-gl-style-spec';
import { useEffect, useMemo } from 'react';
import { StyleSheet, useColorScheme, View } from 'react-native';

import { mapCamera, useMapUiStore } from '@/features/map';
import { usePreferencesStore } from '@/shared/preferences/preferencesStore';
import { ICON_SIZE, MAX_FONT_SCALE, SHAPE, SPACE, TYPE, useThemeColors } from '@/shared/theme';
import { getIndoorPalette } from '@/shared/theme/indoorPalette';
import Icon from '@/shared/ui/Icon';
import { Text } from '@/shared/ui/typography/Text';

import { buildingBounds, floorGeoJSON, routeFloorGeoJSON } from '../domain/floorGeoJSON';
import { campusFloorViews, defaultIndoorLevel } from '../domain/campusFloorViews';
import { campusRoadGeoJSON } from '../domain/campusRoadGeoJSON';
import { CAMPUS_ROAD_SOURCE, campusRoadLayers } from '../domain/campusRoadStyle';
import { campusSceneGeoJSON } from '../domain/indoorSceneGeoJSON';
import { useIndoorStore } from '../store/indoorStore';

export default function IndoorMapLayer({ basemapStyle, onSelectPlace }: { basemapStyle?: StyleSpecification; onSelectPlace?: (venueId: string, placeId: string) => void }) {
  const active = useIndoorStore((s) => s.active);
  const venue = useIndoorStore((s) => s.venue);
  const floor = useIndoorStore((s) => s.floor);
  const plan = useIndoorStore((s) => s.plan);
  const guidance = useIndoorStore((s) => s.guidance);
  const selectedPlaceId = useIndoorStore((s) => s.selectedPlaceId);
  const zoom = useMapUiStore((s) => s.zoom);
  const is3d = useMapUiStore((s) => s.is3d);
  const highContrast = usePreferencesStore((s) => s.highContrast);
  const colors = useThemeColors();
  const palette = getIndoorPalette(useColorScheme() === 'dark' ? 'dark' : 'light');
  const detail = venue.status === 'ready' ? venue.data : null;
  const route = plan.status === 'ready' ? plan.data : null;
  const views = useMemo(() => detail ? campusFloorViews(detail, floor.buildingId, floor.levelRef) : [], [detail, floor.buildingId, floor.levelRef]);
  const roads = useMemo(() => detail ? campusRoadGeoJSON(detail) : null, [detail]);
  const roadLayers = useMemo(() => campusRoadLayers(basemapStyle?.layers ?? []), [basemapStyle]);
  const roadBeforeId = basemapStyle?.layers.find((layer) => layer.type === 'fill-extrusion' || layer.type === 'symbol')?.id ?? 'indoor-cutaway';
  const data = useMemo(() => {
    if (!detail) return null;
    const features = [
      ...views.filter((view) => view.hasDisplayGeometry).flatMap((view) => floorGeoJSON(detail, view.buildingId, view.levelRef).features),
      ...floorGeoJSON(detail, null, null).features,
    ];
    const places = new Map(detail.places.map((place) => [place.id, place]));
    return { type: 'FeatureCollection' as const, features: features.map((feature) => {
      const place = feature.properties.placeId ? places.get(feature.properties.placeId) : null;
      return { ...feature, properties: { ...feature.properties, label: place?.ref ?? feature.properties.name } };
    }) };
  }, [detail, views]);
  const scene = useMemo(() => detail ? campusSceneGeoJSON(detail, floor.buildingId, floor.levelRef) : null, [detail, floor.buildingId, floor.levelRef]);
  const line = useMemo(() => route && detail ? routeFloorGeoJSON(route, detail, floor.buildingId, floor.levelRef) : null, [route, detail, floor.buildingId, floor.levelRef]);
  const selected = detail?.places.find((place) => place.id === selectedPlaceId);
  const visibleSelected = selected?.buildingId === floor.buildingId && selected?.levelRef === floor.levelRef ? selected : null;
  const landings = useMemo(() => {
    if (!data || !detail || zoom <= 18 || route) return [];
    const candidates = data.features.filter((feature) => feature.properties.layer === 'connection');
    candidates.sort((a, b) => Number(b.properties.kind === 'elevator') - Number(a.properties.kind === 'elevator'));
    const visible: typeof candidates = [];
    const latitudeScale = Math.cos(detail.center[1] * Math.PI / 180);
    const metersPerPixel = 156543.03 * latitudeScale / 2 ** zoom;
    const distance = (a: number[], b: number[]) => Math.hypot((a[0] - b[0]) * latitudeScale, a[1] - b[1]) * 111195;
    // 只隱藏互相遮擋的標籤；完整停靠點與可通行資訊仍保留在資料與面板中。
    for (const feature of candidates) {
      if (feature.geometry.type !== 'Point') continue;
      const coordinate = feature.geometry.coordinates;
      if (visibleSelected && distance(coordinate, visibleSelected.location) < metersPerPixel * 90) continue;
      if (visible.some((other) => other.geometry.type === 'Point' && distance(coordinate, other.geometry.coordinates) < metersPerPixel * 74)) continue;
      visible.push(feature);
    }
    return visible;
  }, [data, detail, zoom, route, visibleSelected]);

  useEffect(() => {
    if (!active || !detail) return;
    useMapUiStore.getState().setFollow(null);
    const pitch = useMapUiStore.getState().is3d ? 48 : 0;
    const bounds = floor.buildingId ? buildingBounds(detail, floor.buildingId) : null;
    if (bounds) mapCamera.fitBounds(bounds, { top: 140, left: 24, right: 76 }, { pitch, bearing: 0 });
    else mapCamera.flyTo(detail.center, 18, pitch);
  }, [active, detail, floor.buildingId]);
  useEffect(() => {
    const currentFloor = useIndoorStore.getState().floor;
    if (active && selected && selected.buildingId === currentFloor.buildingId && selected.levelRef === currentFloor.levelRef) {
      mapCamera.flyTo(selected.location, 20.2, useMapUiStore.getState().is3d ? 48 : 0);
    }
  }, [active, selected]);
  useEffect(() => {
    if (!active || !route || !detail) return;
    const currentFloor = useIndoorStore.getState().floor;
    if (guidance.status === 'idle') {
      const visible = routeFloorGeoJSON(route, detail, currentFloor.buildingId, currentFloor.levelRef);
      const points = visible.features.flatMap((feature) => feature.geometry.type === 'LineString' ? feature.geometry.coordinates : []);
      if (points.length >= 2) {
        const lngs = points.map(([lng]) => lng), lats = points.map(([, lat]) => lat);
        mapCamera.fitBounds([Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)],
          { top: 180, left: 24, right: 76 }, { pitch: useMapUiStore.getState().is3d ? 48 : 0, bearing: 0 });
      }
      return;
    }
    const index = guidance.status === 'guiding' ? route.steps[guidance.stepIndex]?.pathStart : guidance.status === 'complete' ? route.path.coordinates.length - 1 : 0;
    const outdoor = index !== undefined && route.path.buildingIds[index] === null && route.path.levelRefs[index] === null;
    const point = index !== undefined && (outdoor || (route.path.buildingIds[index] === currentFloor.buildingId && route.path.levelRefs[index] === currentFloor.levelRef)) ? route.path.coordinates[index] : undefined;
    // 鏡頭跟隨使用者確認的步驟，不以 GPS 推測室內位置。
    if (point) mapCamera.flyTo([point[0], point[1]], 20.2, useMapUiStore.getState().is3d ? 48 : 0);
  }, [active, route, detail, guidance, is3d]);
  if (!active || !data || !scene) return null;

  const selectFeature: NonNullable<GeoJSONSourceProps['onPress']> = (event) => {
    event.stopPropagation();
    const feature = event.nativeEvent.features.find((item) => typeof item.properties?.placeId === 'string');
    const id = feature?.properties?.placeId;
    if (typeof id === 'string') {
      useIndoorStore.getState().selectPlace(id);
      if (detail) onSelectPlace?.(detail.venueId, id);
      return;
    }
    const buildingId = event.nativeEvent.features.find((item) => typeof item.properties?.buildingId === 'string')?.properties?.buildingId;
    const building = detail?.buildings.find((item) => item.id === buildingId);
    const level = building?.levels.find((item) => item.ref === floor.levelRef) ?? defaultIndoorLevel(building?.levels ?? []);
    if (building && level) useIndoorStore.getState().selectFloor({ buildingId: building.id, levelRef: level.ref });
  };
  const m = palette.material;
  return <>
    {roads ? <GeoJSONSource id={CAMPUS_ROAD_SOURCE} data={roads}>
      {roadLayers.map(({ id, type, source: _source, ...style }) => <Layer key={id} id={id} type={type} beforeId={roadBeforeId} {...style} />)}
    </GeoJSONSource> : null}
    <GeoJSONSource id="indoor-scene" data={scene} onPress={selectFeature}>
      <Layer id="indoor-cutaway" type="fill-extrusion" paint={{
        'fill-extrusion-base': ['get', 'base'],
        'fill-extrusion-height': ['get', 'height'],
        'fill-extrusion-opacity': 1,
        'fill-extrusion-vertical-gradient': true,
        'fill-extrusion-color': ['case',
          ['all', ['==', ['get', 'placeId'], selectedPlaceId ?? ''], ['!=', ['get', 'role'], 'wall']], palette.selection,
          ['match', ['get', 'role'],
            'wall', m.wall, 'slab', m.slab, 'room', m.room, 'toilet', m.toilet,
            'corridor', m.corridor, 'elevator', m.elevator, 'stairs', m.stairs,
            'core', m.core, 'nonStopping', m.nonStopping, 'context', m.context,
            'outline', m.outline, 'spaceBoundary', m.spaceBoundary, 'facilityOutline', m.facilityOutline,
            'nonStoppingOutline', m.nonStoppingOutline, m.unknownArea]],
      }} />
    </GeoJSONSource>
    <GeoJSONSource id="indoor-floor" data={data} onPress={selectFeature}>
      <Layer id="indoor-space-boundaries" type="line" filter={['all', ['==', ['get', 'layer'], 'area'], ['==', ['get', 'kind'], 'area']]}
        paint={{ 'line-color': highContrast ? colors.textSecondary : m.spaceBoundary, 'line-width': 0.7, 'line-opacity': 0.65 }} />
      <Layer id="indoor-selected-outline" type="line" filter={['==', ['get', 'layer'], 'wall']}
        paint={{ 'line-color': highContrast ? colors.textSecondary : m.outline, 'line-width': 0.6 }} />
      <Layer id="indoor-place-targets" type="circle" filter={['==', ['get', 'layer'], 'place']}
        paint={{ 'circle-radius': 14, 'circle-opacity': 0 }} />
      <Layer id="indoor-outdoor-places" type="circle" filter={['all', ['==', ['get', 'layer'], 'place'], ['in', ['get', 'kind'], ['literal', ['gate', 'entrance', 'parking']]]]}
        paint={{ 'circle-radius': 5, 'circle-color': palette.primaryCss, 'circle-stroke-color': palette.routeCasingCss, 'circle-stroke-width': 2 }} />
      <Layer id="indoor-labels" type="symbol" minzoom={17.5}
        filter={['all', ['==', ['get', 'layer'], 'place'], ['!=', ['get', 'placeId'], selectedPlaceId ?? ''],
          route ? ['in', ['get', 'placeId'], ['literal', [route.fromPlaceId, route.toPlaceId]]] : true]}
        layout={{ 'text-field': ['get', 'label'], 'text-font': ['Noto Sans Regular'], 'text-size': highContrast ? 14 : 12, 'text-anchor': 'center', 'text-max-width': 7, 'text-padding': 6 }}
        paint={{ 'text-color': highContrast ? colors.text : palette.labelInk, 'text-halo-color': palette.labelBackground, 'text-halo-width': 2 }} />
    </GeoJSONSource>
    {line ? <GeoJSONSource id="indoor-route" data={line}>
      <Layer id="indoor-route-casing" type="line" afterId="indoor-labels" filter={['==', ['geometry-type'], 'LineString']}
        layout={{ 'line-cap': 'round', 'line-join': 'round' }} paint={{ 'line-color': palette.routeCasingCss, 'line-width': 8 }} />
      <Layer id="indoor-route-line" type="line" afterId="indoor-route-casing" filter={['==', ['geometry-type'], 'LineString']}
        layout={{ 'line-cap': 'round', 'line-join': 'round' }} paint={{ 'line-color': palette.primaryCss, 'line-width': 4 }} />
      <Layer id="indoor-route-endpoints" type="circle" afterId="indoor-route-line" filter={['all', ['==', ['geometry-type'], 'Point'], ['in', ['get', 'pathIndex'], ['literal', [0, (route?.path.coordinates.length ?? 1) - 1]]]]}
        paint={{ 'circle-color': palette.primaryCss, 'circle-radius': 6, 'circle-stroke-color': palette.routeCasingCss, 'circle-stroke-width': 2 }} />
    </GeoJSONSource> : null}
    {zoom > 18 && !route ? landings.map((feature) => {
      if (feature.geometry.type !== 'Point') return null;
      const [lng, lat] = feature.geometry.coordinates;
      const kind = feature.properties.kind;
      const label = kind === 'elevator' ? '電梯' : kind === 'ramp' ? '坡道' : kind === 'escalator' ? '手扶梯' : '樓梯';
      return <Marker key={feature.id} lngLat={[lng, lat]} anchor="center">
        <View accessibilityLabel={`${label}，${floor.levelRef ?? '戶外'}`} style={[styles.facility, { backgroundColor: palette.labelBackground, borderColor: palette.labelBorder }]}>
          <View style={[styles.facilityIcon, { backgroundColor: palette.iconBackground }]}>
            <Icon name={kind === 'elevator' ? 'elevator' : kind === 'ramp' ? 'ramp' : 'arrowUpRight'} size={ICON_SIZE.caption} color={palette.iconInk} />
          </View>
          <Text style={{ color: palette.labelInk, fontSize: TYPE.caption, fontWeight: '600' }}>{label}</Text>
        </View>
      </Marker>;
    }) : null}
    {visibleSelected ? <Marker lngLat={visibleSelected.location} anchor="bottom" offset={[0, -6]}>
      <View accessibilityLabel={`已選取 ${visibleSelected.name}`} style={[styles.selected, { backgroundColor: palette.labelSelectedBackground, borderColor: palette.labelSelectedBorder }]}>
        <Icon name="mapPin" size={ICON_SIZE.caption} color={palette.labelSelectedInk} />
        <Text numberOfLines={2} maxFontSizeMultiplier={MAX_FONT_SCALE.label} style={{ color: palette.labelSelectedInk, fontSize: TYPE.footnote, fontWeight: '600', flexShrink: 1 }}>{visibleSelected.name}</Text>
      </View>
    </Marker> : null}
  </>;
}

const styles = StyleSheet.create({
  facility: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs, padding: SPACE.xs, paddingRight: SPACE.sm, borderRadius: SHAPE.pill, borderWidth: 1 },
  facilityIcon: { padding: SPACE.xs, borderRadius: SHAPE.badge },
  selected: { maxWidth: 210, flexDirection: 'row', alignItems: 'center', gap: SPACE.xs, borderRadius: SHAPE.card, borderWidth: 1, paddingHorizontal: SPACE.md, paddingVertical: SPACE.sm },
});
