import { GeoJSONSource, Layer } from '@maplibre/maplibre-react-native';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

import {
  BUS_TWEEN_DURATION_MS,
  EMPTY_LIVE_BUSES,
  buildBusTweens,
  busFrame,
  liveBusCollection,
  selectDisplayBuses,
  type DrawnPosition,
} from '../domain';
import { useBusStore } from '../store/busStore';

const ACCESSIBLE_COLOR = '#2563EB';
const DEFAULT_COLOR = '#334155';
/** 補間期間寫入 GeoJSON 的頻率上限（約 10 fps）。 */
const MIN_FRAME_INTERVAL_MS = 100;

/**
 * 即時公車位置（對齊 Web `LiveBusWrapper`＋`useAnimatedBuses`）：只畫目標車，沒有標記時畫全部；
 * 兩次輪詢之間在 1.2 秒內補間位置。系統開啟「減少動態效果」時直接跳到新位置。
 * 放在 `<Map>` 內；沒有車輛時不渲染。
 */
export default function LiveBusLayer() {
  const buses = useBusStore((s) => s.liveBusPositions);
  const [collection, setCollection] = useState(EMPTY_LIVE_BUSES);
  const [reduceMotion, setReduceMotion] = useState(false);
  const drawn = useRef(new Map<string, DrawnPosition>());

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const enabled = await AccessibilityInfo.isReduceMotionEnabled();
        if (active) setReduceMotion(enabled);
      } catch {
        // 讀不到就維持有動畫。
      }
    };
    void load();
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    const tweens = buildBusTweens(selectDisplayBuses(buses), drawn.current);
    let raf: number | null = null;

    const write = (progress: number) => {
      const frames = busFrame(tweens, progress);
      drawn.current = new Map(frames.map((f) => [f.plateNumb, { lat: f.lat, lng: f.lng, bearing: f.bearing }]));
      setCollection(liveBusCollection(frames));
    };

    if (reduceMotion || tweens.length === 0) {
      write(1);
      return;
    }

    const startedAt = Date.now();
    let lastWrite = 0;
    const step = () => {
      const elapsed = Date.now() - startedAt;
      const progress = Math.min(1, elapsed / BUS_TWEEN_DURATION_MS);
      if (progress >= 1 || elapsed - lastWrite >= MIN_FRAME_INTERVAL_MS) {
        lastWrite = elapsed;
        write(progress);
      }
      if (progress < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => {
      if (raf !== null) cancelAnimationFrame(raf);
    };
  }, [buses, reduceMotion]);

  if (collection.features.length === 0) return null;

  return (
    <GeoJSONSource id="live-buses" data={collection}>
      <Layer
        id="live-buses-circle"
        type="circle"
        paint={{
          'circle-color': ['case', ['==', ['get', 'accessible'], 1], ACCESSIBLE_COLOR, DEFAULT_COLOR],
          'circle-radius': 9,
          'circle-stroke-width': 2.5,
          'circle-stroke-color': '#FFFFFF',
        }}
      />
      <Layer
        id="live-buses-label"
        type="symbol"
        layout={{
          'text-field': ['get', 'plate'],
          'text-font': ['Noto Sans Regular'],
          'text-size': 12,
          'text-offset': [0, 1.5],
          'text-allow-overlap': true,
        }}
        paint={{ 'text-color': '#0F172A', 'text-halo-color': '#FFFFFF', 'text-halo-width': 1.5 }}
      />
    </GeoJSONSource>
  );
}
