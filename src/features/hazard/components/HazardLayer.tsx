import { GeoJSONSource, Layer } from '@maplibre/maplibre-react-native';
import { router, usePathname } from 'expo-router';
import type { FeatureCollection, Point } from 'geojson';
import { useEffect } from 'react';

import { useUserLocationStore } from '@/features/map';

import { refreshNearbyHazards, useHazardLayerStore } from '../controller/hazardLayerController';
import { hazardExpired } from '../domain/review';
import { reportLatLng, type HazardReport } from '../domain/types';

/** 顏色對齊 Web `HazardReportPanel` 的類型圖示（amber／orange／red）。 */
export const HAZARD_COLORS = { obstacle: '#F59E0B', construction: '#F97316', data_error: '#DC2626' } as const;

function toCollection(reports: HazardReport[]): FeatureCollection<Point, { id: string; hazardType: string; verified: boolean }> {
  return {
    type: 'FeatureCollection',
    features: reports
      .filter((r) => (r.status === 'pending' || r.status === 'verified') && !hazardExpired(r))
      .map((r) => {
        const { lat, lng } = reportLatLng(r);
        return {
          type: 'Feature',
          id: r._id,
          geometry: { type: 'Point', coordinates: [lng, lat] },
          properties: { id: r._id, hazardType: r.hazardType, verified: r.status === 'verified' },
        };
      }),
  };
}

/** 附近危險通報（SDD §4.4 `HazardLayer`）：點擊開 `(sheet)/hazard/[id]` 詳情。 */
export default function HazardLayer() {
  const reports = useHazardLayerStore((s) => s.reports);
  const position = useUserLocationStore((s) => s.position);
  const pathname = usePathname();

  useEffect(() => {
    void refreshNearbyHazards();
  }, [position]);

  if (reports.length === 0) return null;

  return (
    <GeoJSONSource
      id="hazards"
      data={toCollection(reports)}
      onPress={(event) => {
        const id = event.nativeEvent.features[0]?.properties?.id;
        if (typeof id !== 'string') return;
        event.stopPropagation();
        const target = { pathname: '/hazard/[id]', params: { id } } as const;
        if (['/loc/', '/place/', '/facility/', '/hazard/'].some((prefix) => pathname.startsWith(prefix))) router.replace(target);
        else router.navigate(target);
      }}>
      <Layer
        id="hazard-points"
        type="circle"
        paint={{
          'circle-color': ['match', ['get', 'hazardType'], 'obstacle', HAZARD_COLORS.obstacle, 'construction', HAZARD_COLORS.construction, HAZARD_COLORS.data_error],
          'circle-radius': 9,
          'circle-stroke-width': ['case', ['get', 'verified'], 3, 2],
          'circle-stroke-color': ['case', ['get', 'verified'], '#111111', '#FFFFFF'],
        }}
      />
      <Layer
        id="hazard-glyph"
        type="symbol"
        layout={{ 'text-field': '!', 'text-font': ['Noto Sans Regular'], 'text-size': 13, 'text-allow-overlap': true }}
        paint={{ 'text-color': '#FFFFFF' }}
      />
    </GeoJSONSource>
  );
}
