import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'react-native-reanimated';


const REVEAL_MS = 600;
const FRAME_MS = 1000 / 30;

/**
 * 路線第一次出現時回傳 0 → 1 的繪出進度（約 600ms，30fps）；之後換路線直接是 1。
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
    const start = Date.now();
    let last = 0;
    let frame = 0;
    setProgress(0);
    const tick = () => {
      const elapsed = Date.now() - start;
      if (elapsed - last >= FRAME_MS || elapsed >= REVEAL_MS) {
        last = elapsed;
        const t = Math.min(1, elapsed / REVEAL_MS);
        setProgress(1 - (1 - t) ** 3);
      }
      if (elapsed < REVEAL_MS) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [routeKey, reduceMotion]);

  return progress;
}
