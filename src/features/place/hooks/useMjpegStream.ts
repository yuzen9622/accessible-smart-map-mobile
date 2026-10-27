import { fetch as expoFetch } from 'expo/fetch';
import { useEffect, useState } from 'react';

import { bytesToBase64, createMjpegParser } from '../domain/mjpegParser';

/** 畫面最高更新頻率：來源有 5–15 fps，但 base64 + 重繪每幀都要花 JS 執行緒時間，10 fps 足夠看路口車流。 */
const MIN_RENDER_INTERVAL_MS = 100;

export type MjpegStreamState =
  | { status: 'connecting' }
  | { status: 'live'; frameUri: string }
  | { status: 'error' };

/**
 * 連上 MJPEG 串流並持續回傳最新一幀（data URI）。`url` 為 undefined 時不連線；unmount 或換
 * URL 會 abort 掉前一條連線。換 URL 時狀態不會自動重置，呼叫端要用 `key` 讓元件重掛。
 * 用 `expo/fetch` 是因為只有它的 `Response.body` 是可讀串流（同 `shared/api/sse.ts`）。
 * 切幀邏輯在 `domain/mjpegParser.ts`。
 */
export function useMjpegStream(url: string | undefined): MjpegStreamState {
  const [state, setState] = useState<MjpegStreamState>({ status: 'connecting' });

  useEffect(() => {
    if (!url) return;
    const controller = new AbortController();

    const run = async () => {
      try {
        const response = await expoFetch(url, { signal: controller.signal });
        if (!response.ok || !response.body) throw new Error(`CCTV stream HTTP ${response.status}`);

        const parser = createMjpegParser();
        const reader = response.body.getReader();
        let lastRenderAt = 0;
        try {
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            const frames = parser.feed(value);
            const latest = frames[frames.length - 1];
            const now = Date.now();
            if (latest && now - lastRenderAt >= MIN_RENDER_INTERVAL_MS) {
              lastRenderAt = now;
              if (!controller.signal.aborted) {
                setState({ status: 'live', frameUri: `data:image/jpeg;base64,${bytesToBase64(latest)}` });
              }
            }
          }
        } finally {
          reader.releaseLock();
        }
        // 來源主動結束串流：沒有新畫面了，不能停在最後一幀假裝還是即時的。
        if (!controller.signal.aborted) setState({ status: 'error' });
      } catch {
        if (!controller.signal.aborted) setState({ status: 'error' });
      }
    };
    void run();

    return () => controller.abort();
  }, [url]);

  return state;
}
