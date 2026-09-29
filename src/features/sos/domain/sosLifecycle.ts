import type { SosSnapshot } from './types';

/**
 * 發起者畫面的 SOS 即時狀態，移植自 Web `src/hook/useSosLifecycle.ts`（commit f82cda8）的策略：
 * 先 GET snapshot → 訂閱 SSE `update` → 連續失敗 3 次後退回每 8 秒輪詢（SDD §6.8）。
 *
 * Web 把策略寫在 React effect 裡、沒有測試；本檔抽成注入 port 的純狀態機，才能在 node 下以 fake timer 測
 * （ROADMAP 3.2「補寫 lifecycle 測試」）。
 *
 * 差異：
 * - Web 的 `fetchEventSource` 在伺服器正常關閉串流時直接結束、不重連，畫面就停在最後一筆。後端在 access
 *   token 過期（60 分鐘）或 session 被撤銷時會主動關串流，所以原生把「串流結束」也當成一次失敗重連（計入重試次數），
 *   每次重連都重新取 token（`openStream` 由呼叫端帶當下的 Authorization）。
 * - 重試間隔沿用 Web `onerror` 回傳的 `min(1000 × 次數, 5000)` ms。
 */

export type SosLifecycleStatus = 'connecting' | 'streaming' | 'polling' | 'error';

export interface SosStreamHandlers {
  /** 回應標頭到達；非 2xx 時呼叫端應 throw。 */
  onOpen: () => void;
  onSnapshot: (snapshot: SosSnapshot) => void;
}

export interface SosLifecycleDeps {
  fetchSnapshot: (signal: AbortSignal) => Promise<SosSnapshot | null>;
  /** 串流結束時 resolve、連線或讀取失敗時 reject。 */
  openStream: (handlers: SosStreamHandlers, signal: AbortSignal) => Promise<void>;
  pollIntervalMs?: number;
  maxStreamRetries?: number;
}

export interface SosLifecycleCallbacks {
  onSnapshot: (snapshot: SosSnapshot) => void;
  onStatus: (status: SosLifecycleStatus) => void;
}

export interface SosLifecycle {
  stop: () => void;
}

export const SOS_POLL_MS = 8000;
export const SOS_MAX_STREAM_RETRIES = 3;

function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve();
      return;
    }
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      resolve();
    };
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

export function startSosLifecycle(deps: SosLifecycleDeps, callbacks: SosLifecycleCallbacks): SosLifecycle {
  const pollMs = deps.pollIntervalMs ?? SOS_POLL_MS;
  const maxRetries = deps.maxStreamRetries ?? SOS_MAX_STREAM_RETRIES;
  const controller = new AbortController();
  const { signal } = controller;
  let pollTimer: ReturnType<typeof setInterval> | null = null;

  const apply = (snapshot: SosSnapshot | null) => {
    if (!signal.aborted && snapshot) callbacks.onSnapshot(snapshot);
  };
  const setStatus = (status: SosLifecycleStatus) => {
    if (!signal.aborted) callbacks.onStatus(status);
  };

  const startPolling = () => {
    if (signal.aborted || pollTimer) return;
    setStatus('polling');
    const tick = async () => {
      try {
        // authenticatedRequest 會透明地 refresh 過期 token，所以輪詢也能救回讓串流斷掉的認證失敗。
        apply(await deps.fetchSnapshot(signal));
      } catch {
        setStatus('error');
      }
    };
    void tick();
    pollTimer = setInterval(() => void tick(), pollMs);
  };

  const run = async () => {
    setStatus('connecting');
    // 先拿一份快照，讓第一個 SSE 事件到之前畫面就有資料。
    try {
      apply(await deps.fetchSnapshot(signal));
    } catch {
      // 忽略：串流（或輪詢備援）會再試
    }
    let retries = 0;
    while (!signal.aborted) {
      try {
        await deps.openStream(
          {
            onOpen: () => {
              retries = 0;
              setStatus('streaming');
            },
            onSnapshot: apply,
          },
          signal,
        );
      } catch {
        // 連線或讀取失敗：與「伺服器結束串流」同樣處理（見檔頭）
      }
      if (signal.aborted) return;
      retries += 1;
      if (retries >= maxRetries) {
        startPolling();
        return;
      }
      await wait(Math.min(1000 * retries, 5000), signal);
    }
  };

  void run();

  return {
    stop: () => {
      controller.abort();
      if (pollTimer) clearInterval(pollTimer);
      pollTimer = null;
    },
  };
}
