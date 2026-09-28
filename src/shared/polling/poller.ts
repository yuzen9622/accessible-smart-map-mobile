/**
 * App 前景感知的輪詢器。把 Web 版公車 hook（`useBusLegStopEtas`／`useLiveBusPositions`，commit 5eadc71）
 * 裡重複的 `tick`／`scheduleNext`／`visibilitychange` 迴圈抽成一份，語意逐條保留：
 *
 * - 任何時刻最多一個待觸發的計時器：`scheduleNext` 一定先清掉前一個，重疊觸發（例如回前景時剛好在跑）
 *   不會讓頻率加倍。
 * - 間隔從**每次工作完成後**才開始算，慢請求不會疊在下一輪後面。
 * - 背景時不打 API，只排下一輪；回到前景立即跑一次（SDD §6.5「回前景立即刷新」）。
 * - `stop()` 會 abort 進行中的工作，之後不再排程。
 *
 * 前景狀態由注入的 `VisibilitySource` 提供（正式環境用 `appStateVisibility`），測試可替換。
 * 本檔不 import react-native，可在 node 下測。
 */

export interface VisibilitySource {
  isActive(): boolean;
  /** 前景狀態改變時呼叫 `onChange(active)`；回傳取消訂閱。 */
  subscribe(onChange: (active: boolean) => void): () => void;
}

export interface PollContext {
  signal: AbortSignal;
  /** 第一輪為 true。Web 的 ETA 輪詢第一輪走快取、之後強制刷新，靠這個區分。 */
  first: boolean;
}

export interface PollerOptions {
  intervalMs: number;
  task: (ctx: PollContext) => Promise<void>;
  visibility: VisibilitySource;
}

export interface Poller {
  start(): void;
  stop(): void;
}

export function createPoller({ intervalMs, task, visibility }: PollerOptions): Poller {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let controller: AbortController | null = null;
  let unsubscribe: (() => void) | null = null;
  let running = false;
  let first = true;

  function clearTimer(): void {
    if (timer) clearTimeout(timer);
    timer = null;
  }

  function scheduleNext(): void {
    clearTimer();
    timer = setTimeout(() => {
      void tick();
    }, intervalMs);
  }

  async function tick(): Promise<void> {
    if (!running) return;
    if (!visibility.isActive()) {
      scheduleNext();
      return;
    }
    clearTimer();
    controller?.abort();
    const current = new AbortController();
    controller = current;
    const isFirst = first;
    first = false;
    try {
      await task({ signal: current.signal, first: isFirst });
    } catch {
      // 暫時性失敗：保留上一次的好資料，下一輪重試（對齊 Web）。
    }
    if (running && controller === current) scheduleNext();
  }

  return {
    start() {
      if (running) return;
      running = true;
      first = true;
      unsubscribe = visibility.subscribe((active) => {
        if (running && active) void tick();
      });
      void tick();
    },
    stop() {
      running = false;
      clearTimer();
      controller?.abort();
      controller = null;
      unsubscribe?.();
      unsubscribe = null;
    },
  };
}
