import { getAppConfig } from '@/shared/config';

import type { VoiceSocket } from '../domain/voiceSession';

/** `wss://<host>/api/v1/voice/ws`（協定 §2.1）；token 只放在首訊息 `session.start`，絕不放進 URL。 */
export function voiceWsUrl(): string {
  return `${getAppConfig().apiBaseUrl.replace(/^http/, 'ws')}/api/v1/voice/ws`;
}

/**
 * RN 內建 WebSocket 包成 `VoiceSocket`。`binaryType` 必須在任何 handler 之前設成 `arraybuffer`
 * （預設 `blob` 會讓所有下行音訊 frame 靜默消失，SDD §6.7）；controller 在建立後才掛 handler（Web `voiceSession.ts:355`）。
 */
export function createVoiceSocket(url: string): VoiceSocket {
  const ws = new WebSocket(url);
  ws.binaryType = 'arraybuffer';
  const socket: VoiceSocket = {
    // RN WebSocket 在 CONNECTING 時 send 會丟 INVALID_STATE_ERR；連線中就結束對話（terminate 會送 session.end）
    // 時 throw 會讓 controller 跳過 close() 與狀態收尾，session 卡在「連線中」。未開啟時直接丟棄。
    send: (data) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(data);
    },
    close: (code, reason) => ws.close(code, reason),
    onopen: null,
    onmessage: null,
    onclose: null,
    onerror: null,
  };
  ws.onopen = () => socket.onopen?.();
  ws.onmessage = (event) => socket.onmessage?.({ data: event.data });
  ws.onclose = (event) => socket.onclose?.({ code: event.code, reason: event.reason });
  ws.onerror = (event) => socket.onerror?.(event);
  return socket;
}
