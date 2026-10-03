/**
 * 回音閘門：助理語音從喇叭播出時，麥克風會收回同一段聲音；送回後端的話，Gemini 會把自己的話當成
 * 使用者新的發言，於是打斷自己、不停重複回答（使用者回報 2026-09-30）。
 *
 * iOS 真機由 voice processing 消除回音（見 `patches/react-native-audio-api+0.13.6.patch`），持續上傳
 * 麥克風資料，讓後端 VAD 偵測使用者插話。未啟用系統回音消除的平台保留半雙工保護：
 *
 * - 助理語音播放中，以及播完（或被清空）後 `tailMs` 內：丟掉所有麥克風 frame。
 * - 其他時間全部放行。
 *
 * 不做「音量夠大就當插話」：2026-10-01 實測（模擬器、MacBook 喇叭）回音音量 0.36–0.44，與人聲（0.3–0.8）重疊，
 * 以音量判斷插話會把回音放行。半雙工的代價是助理說話時不能用聲音打斷；不能套用到需要插話的 iPhone。
 *
 * 時間軸：每段下行音訊依序接在上一段後面（與播放佇列一致），所以 `notePlayback(durationMs)` 是累加。
 */
export interface EchoGateOptions {
  now: () => number;
  forward: (frame: ArrayBuffer) => void;
  /** 由原生 AEC 處理回音時持續上傳，讓使用者可在助理播放中插話。預設保留半雙工。 */
  echoCancellationEnabled?: boolean;
  /** 播完或被清空後仍視為回音的時間（喇叭輸出延遲＋房間殘響）。 */
  tailMs?: number;
}

export interface EchoGate {
  /** 排進播放佇列一段音訊。 */
  notePlayback(durationMs: number): void;
  /** 播放佇列被清空（打斷、結束、靜音）：剩下的排程作廢，但尾音照算。 */
  clear(): void;
  /** 麥克風送來一個 frame。 */
  push(frame: ArrayBuffer): void;
}

export const ECHO_TAIL_MS = 400;

export function createEchoGate({
  now,
  forward,
  echoCancellationEnabled = false,
  tailMs = ECHO_TAIL_MS,
}: EchoGateOptions): EchoGate {
  // 從未播放＝-Infinity（用 0 的話，時鐘從 0 開始時第一個尾音窗會誤擋）
  let playingUntil = Number.NEGATIVE_INFINITY;

  return {
    notePlayback(durationMs) {
      playingUntil = Math.max(playingUntil, now()) + Math.max(0, durationMs);
    },
    clear() {
      // 喇叭裡已送出的聲音與殘響不會因為清空佇列而消失：從現在起再算一段尾音
      playingUntil = Math.min(playingUntil, now());
    },
    push(frame) {
      if (echoCancellationEnabled || now() >= playingUntil + tailMs) forward(frame);
    },
  };
}
