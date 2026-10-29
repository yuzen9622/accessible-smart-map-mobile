import { GeoJSONSource, Layer, type GeoJSONSourceProps } from '@maplibre/maplibre-react-native';
import type { FeatureCollection, Polygon } from 'geojson';
import { useEffect, useMemo, useState } from 'react';

import { useMapUiStore } from '@/features/map';
import { useThemeColors } from '@/shared/theme';

import { loadVenue } from '../api/venueApi';
import { useIndoorStore } from '../store/indoorStore';
import type { VenueDetail } from '../types/venue';

/** 一般地圖上的可瀏覽建築；點選後原地切換樓層，不開另一套搜尋或規劃頁。 */
export default function VenueFootprintLayer() {
  const catalog = useIndoorStore((s) => s.catalog);
  const selectedVenueId = useIndoorStore((s) => s.selectedVenueId);
  const active = useIndoorStore((s) => s.active);
  const center = useMapUiStore((s) => s.center);
  const zoom = useMapUiStore((s) => s.zoom);
  const [details, setDetails] = useState<VenueDetail[]>([]);
  const colors = useThemeColors();
  useEffect(() => {
    if (useIndoorStore.getState().catalog.status === 'idle') void useIndoorStore.getState().loadCatalog();
  }, []);
  const nearbyIds = catalog.status === 'ready' && center && zoom >= 14
    ? catalog.data.filter((venue) => Math.hypot((venue.center[0] - center[0]) * Math.cos(center[1] * Math.PI / 180), venue.center[1] - center[1]) * 111195 < 2500).map((venue) => venue.venueId).sort().join('|')
    : '';
  useEffect(() => {
    if (!nearbyIds) return;
    const controller = new AbortController();
    void Promise.allSettled(nearbyIds.split('|').map((id) => loadVenue(id, controller.signal))).then((results) => {
      if (!controller.signal.aborted) setDetails(results.flatMap((result) => result.status === 'fulfilled' ? [result.value] : []));
    });
    return () => controller.abort();
  }, [nearbyIds]);
  const data = useMemo<FeatureCollection<Polygon>>(() => ({
    type: 'FeatureCollection',
    features: details.filter((detail) => nearbyIds.split('|').includes(detail.venueId) && (!active || detail.venueId !== selectedVenueId)).flatMap((detail) => detail.buildings.map((building) => ({
      type: 'Feature', id: `${detail.venueId}:${building.id}`,
      geometry: { type: 'Polygon', coordinates: building.footprint },
      properties: { venueId: detail.venueId, buildingId: building.id },
    }))),
  }), [details, selectedVenueId, active, nearbyIds]);
  const onPress: NonNullable<GeoJSONSourceProps['onPress']> = (event) => {
    const target = event.nativeEvent.features[0]?.properties;
    if (typeof target?.venueId !== 'string' || typeof target.buildingId !== 'string') return;
    event.stopPropagation();
    const venueId = target.venueId;
    const buildingId = target.buildingId;
    void (async () => {
      await useIndoorStore.getState().selectVenue(venueId);
      const state = useIndoorStore.getState();
      if (state.venue.status !== 'ready' || state.venue.data.venueId !== venueId) return;
      const building = state.venue.data.buildings.find((item) => item.id === buildingId);
      const level = building?.levels.find((item) => item.ref === '1F' || item.ref === '1') ?? building?.levels[0];
      if (level) state.selectFloor({ buildingId, levelRef: level.ref });
    })();
  };
  return <GeoJSONSource id="venue-footprints" data={data} onPress={onPress}>
    <Layer id="venue-footprint-fill" type="fill" paint={{ 'fill-color': colors.textSecondary, 'fill-opacity': 0.12 }} />
    <Layer id="venue-footprint-outline" type="line" paint={{ 'line-color': colors.textSecondary, 'line-opacity': 0.3, 'line-width': 1 }} />
  </GeoJSONSource>;
}
