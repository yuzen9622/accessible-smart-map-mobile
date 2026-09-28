import { GeoJSONSource, Layer } from '@maplibre/maplibre-react-native';
import type { Feature, FeatureCollection, Point } from 'geojson';

import { usePlaceUiStore } from '../store/placeUiStore';
import type { PlaceDetail } from '../types/place';

const PLACE_PIN_COLOR = '#E53935';

const EMPTY_COLLECTION: FeatureCollection<Point, { id: string }> = { type: 'FeatureCollection', features: [] };

/**
 * 選定地點／搜尋結果的地圖 pin（SDD §4.4 `SearchPinLayer`，對齊 Web
 * `SearchPin` 元件，commit 5eadc71，改用原生分群同款的
 * `GeoJSONSource` + `circle` Layer，取代 Web 版 React marker）。
 *
 * `data` 保持參照穩定：沒有選定地點時固定回傳同一個 `EMPTY_COLLECTION`
 * 常數，有選定地點時由 React Compiler 依 selectedPlace 自動 memo，避免每次
 * 無關的 re-render 都讓 maplibre 重新處理整個 source。
 */
function buildCollection(selectedPlace: PlaceDetail | null): FeatureCollection<Point, { id: string }> {
  if (!selectedPlace) return EMPTY_COLLECTION;
  const { lat, lng } = selectedPlace.position;
  const id = selectedPlace.kind === 'place' ? selectedPlace.place.id : `coord:${lat},${lng}`;
  const feature: Feature<Point, { id: string }> = {
    type: 'Feature',
    id,
    geometry: { type: 'Point', coordinates: [lng, lat] },
    properties: { id },
  };
  return { type: 'FeatureCollection', features: [feature] };
}

export default function PlacePinLayer() {
  const selectedPlace = usePlaceUiStore((state) => state.selectedPlace);

  const collection = buildCollection(selectedPlace);

  if (collection.features.length === 0) return null;

  return (
    <GeoJSONSource id="place-pin" data={collection}>
      <Layer
        id="place-pin-point"
        type="circle"
        paint={{
          'circle-color': PLACE_PIN_COLOR,
          'circle-radius': 9,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#FFFFFF',
        }}
      />
    </GeoJSONSource>
  );
}
