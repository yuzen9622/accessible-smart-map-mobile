import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'react-native-reanimated';

const REVEAL_MS = 1800;
// 等待規劃完成後的相機取景與 sheet 收合，再開始繪線。
const REVEAL_DELAY_MS = 800;

/**
 * 路線第一次出現時回傳 0 → 1 的繪出進度（約 1800ms，跟隨螢幕更新）；之後換路線直接是 1。
 * 降低動態時一律 1。`routeKey` 為空代表目前沒有路線。
 */
export function useRouteReveal(routeKey: string | null): number {
  const reduceMotion = useReducedMotion();
  const [progress, setProgress] = useState(1);
  const hadRoute = useRef(false);

  useEffect(() => {
    const first = routeKey !== null && !hadRoute.current;
    hadRoute.current = routeKey !== null;
    if (!first || reduceMotion) {
      setProgress(1);
      return;
    }
    let frame = 0;
    setProgress(0);
    const timer = setTimeout(() => {
      const start = performance.now();
      const tick = (timestamp: number) => {
        const elapsed = timestamp - start;
        const t = Math.min(1, Math.max(0, elapsed / REVEAL_MS));
        setProgress(1 - (1 - t) ** 3);
        if (elapsed < REVEAL_MS) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    }, REVEAL_DELAY_MS);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(frame);
    };
  }, [routeKey, reduceMotion]);

  return progress;
}
