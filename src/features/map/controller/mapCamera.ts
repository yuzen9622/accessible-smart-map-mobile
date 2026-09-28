import type { CameraRef, LngLat, LngLatBounds, ViewPadding } from '@maplibre/maplibre-react-native';

import { useMapUiStore } from '../store/mapUiStore';

/**
 * MapController port（SDD §4.3）：其他 feature 透過這裡移動相機，不直接拿 CameraRef。
 * Spike A 發現 `<Camera padding>` 變更不影響 flyTo 置中，所以每個動作都帶入目前的 sheet inset。
 */
let camera: CameraRef | null = null;
/** 任何明確的相機動作（深層連結、搜尋結果、定位按鈕）之後，啟動時的自動定位就不再搶鏡頭 */
let claimed = false;

export function registerMapCamera(ref: CameraRef | null): void {
  camera = ref;
}

export function isCameraClaimed(): boolean {
  return claimed;
}

function currentPadding(extraTop = 0): ViewPadding {
  return { top: extraTop, bottom: useMapUiStore.getState().sheetInset, left: 0, right: 0 };
}

export const mapCamera = {
  flyTo(center: LngLat, zoom?: number): void {
    claimed = true;
    camera?.flyTo({ center, zoom, padding: currentPadding() });
  },
  easeTo(center: LngLat, zoom?: number, duration = 500): void {
    claimed = true;
    camera?.easeTo({ center, zoom, duration, padding: currentPadding() });
  },
  /** `edge` 是 sheet inset 以外、額外保留的邊距（例：路線要避開頂部浮動控制，對齊 Web top 70／左右 40）。 */
  fitBounds(bounds: LngLatBounds, edge?: { top?: number; left?: number; right?: number }): void {
    claimed = true;
    camera?.fitBounds(bounds, {
      padding: { ...currentPadding(edge?.top ?? 0), left: edge?.left ?? 0, right: edge?.right ?? 0 },
      duration: 800,
    });
  },
  /** 冷啟動第一個 GPS fix：只在沒有其他相機動作搶先時置中一次（對齊 Web hasAutoLocatedRef） */
  autoCenterOnce(center: LngLat, zoom: number): boolean {
    if (claimed || !camera) return false;
    claimed = true;
    camera.flyTo({ center, zoom, padding: currentPadding() });
    return true;
  },
  async setPitch(pitch: number): Promise<void> {
    await camera?.setStop({ pitch, duration: 600, easing: 'ease' });
  },
};
