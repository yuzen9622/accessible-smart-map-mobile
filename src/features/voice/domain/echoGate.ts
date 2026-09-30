import { rmsLevel } from './audioLevel';

/**
 * 回音閘門：助理語音從喇叭播出時，麥克風會收回同一段聲音；送回後端的話，Gemini 會把自己的話當成使用者新的發言，
 * 於是不停重複回答（使用者回報 2026-09-30）。Web 靠瀏覽器 `getUserMedia({ echoCancellation })`，原生的系統回音消除
 * （iOS voice processing）不一定可用（模擬器、藍牙、舊裝置），所以在上行多加這一層半雙工保險：
 *
 * - 播放中（含 `tailMs` 尾音，涵蓋喇叭與房間殘響）：低於插話門檻的 frame 丟掉。
 * - 連續 `bargeInFrames` 個 frame 都高於門檻＝使用者直接對麥克風插話：放行，並補送這幾個開頭 frame
 *   （不然插話的第一個字會被吃掉），之後到播放結束都放行。後端收到插話會送 `interrupted`，呼叫端再 `clear()`。
 * - 沒有播放時全部放行。
 *
 * 時間軸：每段下行音訊依序接在上一段後面（與播放佇列一致），所以要用 `notePlayback(durationMs)` 累加，而不是只記最後一段。
 */
export interface EchoGateOptions {
  now: () => number;
  forward: (frame: ArrayBuffer) => void;
  /** 播完後仍視為回音的時間（喇叭延遲＋殘響）。 */
  tailMs?: number;
  /** `rmsLevel` 插話門檻（語音約 0.3–0.8，回授到麥克風的回音通常明顯較低）。 */
  bargeInLevel?: number;
  /** 需要連續幾個大聲 frame（每個 100 ms）才算插話。 */
  bargeInFrames?: number;
}

export interface EchoGate {
  /** 排進播放佇列一段音訊。 */
  notePlayback(durationMs: number): void;
  /** 播放佇列被清空（打斷、結束、靜音）。 */
  clear(): void;
  /** 麥克風送來一個 frame。 */
  push(frame: ArrayBuffer): void;
}

export const ECHO_TAIL_MS = 400;
export const BARGE_IN_LEVEL = 0.35;
export const BARGE_IN_FRAMES = 3;

export function createEchoGate({
  now,
  forward,
  tailMs = ECHO_TAIL_MS,
  bargeInLevel = BARGE_IN_LEVEL,
  bargeInFrames = BARGE_IN_FRAMES,
}: EchoGateOptions): EchoGate {
  // 從未播放＝-Infinity（用 0 的話，時鐘從 0 開始時第一個尾音窗會誤擋）
  let playingUntil = Number.NEGATIVE_INFINITY;
  let bargedIn = false;
  let pending: ArrayBuffer[] = [];

  const reset = () => {
    bargedIn = false;
    pending = [];
  };

  return {
    notePlayback(durationMs) {
      const t = now();
      playingUntil = Math.max(playingUntil, t) + Math.max(0, durationMs);
    },
    clear() {
      playingUntil = Number.NEGATIVE_INFINITY;
      reset();
    },
    push(frame) {
      if (now() >= playingUntil + tailMs) {
        reset();
        forward(frame);
        return;
      }
      if (bargedIn) {
        forward(frame);
        return;
      }
      if (rmsLevel(frame) < bargeInLevel) {
        pending = [];
        return;
      }
      pending.push(frame);
      if (pending.length < bargeInFrames) return;
      bargedIn = true;
      const burst = pending;
      pending = [];
      for (const f of burst) forward(f);
    },
  };
}
