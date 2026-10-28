import type { CameraRef, LngLat, LngLatBounds, ViewPadding } from '@maplibre/maplibre-react-native';

import { isReduceMotionEnabled, motionDuration } from '@/shared/accessibility';

import { MAP_PITCH_3D } from '../domain/basemap';
import { useMapUiStore, type MapFollowMode } from '../store/mapUiStore';

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

/** 「減少動態效果」開啟時不飛行、不縮放動畫：直接跳到終點（SDD §10）。 */
function moveTo(options: { center: LngLat; zoom?: number; pitch?: number; padding: ViewPadding }): void {
  if (isReduceMotionEnabled()) camera?.jumpTo(options);
  else camera?.flyTo(options);
}

export const mapCamera = {
  flyTo(center: LngLat, zoom?: number, pitch?: number): void {
    claimed = true;
    moveTo({ center, zoom, pitch, padding: currentPadding() });
  },
  easeTo(center: LngLat, zoom?: number, duration = 500): void {
    claimed = true;
    if (isReduceMotionEnabled()) camera?.jumpTo({ center, zoom, padding: currentPadding() });
    else camera?.easeTo({ center, zoom, duration, padding: currentPadding() });
  },
  /** `edge` 是 sheet inset 以外、額外保留的邊距（例：路線要避開頂部浮動控制，對齊 Web top 70／左右 40）。 */
  fitBounds(bounds: LngLatBounds, edge?: { top?: number; left?: number; right?: number }): void {
    claimed = true;
    camera?.fitBounds(bounds, {
      padding: { ...currentPadding(edge?.top ?? 0), left: edge?.left ?? 0, right: edge?.right ?? 0 },
      duration: motionDuration(800),
    });
  },
  /** 冷啟動第一個 GPS fix：只在沒有其他相機動作搶先時置中一次（對齊 Web hasAutoLocatedRef） */
  autoCenterOnce(center: LngLat, zoom: number): boolean {
    if (claimed || !camera) return false;
    claimed = true;
    moveTo({ center, zoom, padding: currentPadding() });
    return true;
  },
  /**
   * 導航跟隨：交給 maplibre 原生 `trackUserLocation`（步行 heading＝羅盤、開車 course＝行進方向），
   * 不在 JS 每幀 jumpTo（Web 做法）——原生追蹤更順、更省電，使用者拖曳地圖時由原生自動解除。
   */
  follow(mode: MapFollowMode, zoom: number, pitch: number): void {
    claimed = true;
    useMapUiStore.getState().setFollow({ mode, zoom, pitch });
  },
  /** 結束跟隨：恢復使用者自己的 2D/3D 俯角並轉回正北（導航的 60° 俯角與航向不留在一般瀏覽）。 */
  stopFollow(): void {
    const { is3d, setFollow } = useMapUiStore.getState();
    setFollow(null);
    void camera?.setStop({ pitch: is3d ? MAP_PITCH_3D : 0, bearing: 0, duration: motionDuration(600), easing: 'ease' });
  },
  async setPitch(pitch: number): Promise<void> {
    await camera?.setStop({ pitch, duration: motionDuration(600), easing: 'ease' });
  },
};
