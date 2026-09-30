import { useEffect, useState } from 'react';

import { isPrefixExtension, nextRevealCount, type StreamRevealOptions } from '../domain/streamingText';

/**
 * 原生 markdown 每次換字串都要重新排版，比 DOM 更新貴：心跳用 32ms（Web 16ms），
 * 追趕速度由 `nextRevealCount` 的 catch-up 比例決定，落後量上限不變。
 */
const TICK_MS = 32;

interface RevealState {
  text: string;
  count: number;
}

/**
 * 把「已到貨的文字」平滑成「正在顯示的文字」。移植自 Web `src/hook/useSmoothStream.ts`（commit f5027af）。
 *
 * 後端一個 `token` 事件可能一次吐一整句，直接畫會一塊一塊跳。這裡讓顯示落後一小段並穩定追上，
 * 串流一結束（`enabled` 轉 false）立刻補完。只有新字串**不是**舊字串的延伸時才歸零（SDD §6.6 不變量：
 * 累積式串流不可每個 chunk 從頭重播）。
 *
 * 與 Web 的差異：Web 在 render 中讀寫 ref 比對上一個字串；本 repo 的 `react-hooks/refs` 規則禁止，
 * 改成把「上一個字串」放進 state，用 React 官方的「render 期間依 props 調整 state」模式同步歸零。
 */
export function useSmoothStream(
  text: string,
  { enabled = true, options }: { enabled?: boolean; options?: StreamRevealOptions } = {},
): string {
  const [state, setState] = useState<RevealState>(() => ({ text, count: enabled ? 0 : text.length }));

  let current = state;
  if (state.text !== text) {
    current = { text, count: isPrefixExtension(state.text, text) ? state.count : 0 };
    setState(current);
  }

  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => {
      setState((prev) => {
        const next = nextRevealCount({ target: prev.text.length, current: prev.count, streaming: true, options });
        return next === prev.count ? prev : { ...prev, count: next };
      });
    }, TICK_MS);
    return () => clearInterval(id);
  }, [enabled, options]);

  return enabled ? text.slice(0, Math.min(current.count, text.length)) : text;
}
