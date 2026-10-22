import { useEffect, useState } from 'react';

/** 目前時間，每 `intervalMs` 重新渲染一次；倒數類文字（「8 分後」）靠它跟著時間走，不必重抓資料。 */
export function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
