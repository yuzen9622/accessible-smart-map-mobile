// 新寫（Web 沒有對應檔）：後端 SSE 串流的解讀與 bubble 更新的純函式。
// - `interpretChatSseEvent`：Web `streamChatWithAgent`（`src/lib/api/ai.ts`）把 `event:` 行整行丟掉、只看 `data:`，
//   也不解析 `error` event；後端（ai.chat.controller.ts）送的是標準 SSE（token／tool_call／tool_result／error／done），
//   這裡依 event 名稱解讀，並保留 Web 的舊格式（event 為 message、`[DONE]`、`{text}`、OpenAI delta）當容錯。
// - `applyToken`／`applyToolCall`／`applyToolResult`／`settleBubble`：逐項對照 Web `src/hook/useAIChat.ts`（commit f5027af）
//   的 onChunk／onToolCall／finally 對 assistant bubble 的改動。
import { isRec } from './aiResults';
import type { ChatBubble, ToolActivity } from './types';

export type ChatStreamSignal =
  | { type: 'token'; text: string }
  | { type: 'tool-call'; name: string; args: string }
  | { type: 'tool-result'; name: string; result: unknown }
  | { type: 'error'; code: number | null; message: string }
  | { type: 'done' };

export interface SseEventLike {
  event: string;
  data: string;
}

function parseJson(data: string): unknown {
  try {
    return JSON.parse(data);
  } catch {
    return undefined;
  }
}

/** 工具參數一律轉成 JSON 字串往上傳（與 Web 相同）；物件 → JSON.stringify。 */
function argsToString(args: unknown): string {
  if (args === undefined || args === null) return '';
  return typeof args === 'string' ? args : JSON.stringify(args);
}

function isDoneMarker(data: string): boolean {
  const raw = data.trim();
  return raw === '[DONE]' || raw === 'done';
}

function tokenOf(text: unknown): ChatStreamSignal | null {
  return typeof text === 'string' ? { type: 'token', text } : null;
}

/** Web 舊格式（沒有具名 event）：依欄位形狀判斷，順序與 Web 相同。 */
function interpretLegacy(payload: unknown): ChatStreamSignal | null {
  if (!isRec(payload)) return null;
  const name = payload.name;
  if (typeof name === 'string' && name) {
    if (payload.args !== undefined) return { type: 'tool-call', name, args: argsToString(payload.args) };
    if (payload.result !== undefined) return { type: 'tool-result', name, result: payload.result };
    if (payload.arguments !== undefined) return { type: 'tool-call', name, args: argsToString(payload.arguments) };
  }
  if (payload.text !== undefined) return tokenOf(payload.text);

  const choices = payload.choices;
  const first: unknown = Array.isArray(choices) ? choices[0] : undefined;
  const content: unknown = isRec(first) && isRec(first.delta) ? first.delta.content : undefined;
  return typeof content === 'string' && content ? { type: 'token', text: content } : null;
}

/**
 * 把一個 SSE event 解讀成串流訊號。無法解讀（JSON 壞掉、欄位缺漏、未知 event 如 ping）回 `null`，呼叫端略過即可。
 */
export function interpretChatSseEvent(event: SseEventLike): ChatStreamSignal | null {
  switch (event.event) {
    case 'done':
      return { type: 'done' };

    case 'token': {
      const payload = parseJson(event.data);
      return isRec(payload) ? tokenOf(payload.text) : null;
    }

    case 'tool_call': {
      const payload = parseJson(event.data);
      if (!isRec(payload) || typeof payload.name !== 'string' || !payload.name) return null;
      return { type: 'tool-call', name: payload.name, args: argsToString(payload.args) };
    }

    case 'tool_result': {
      const payload = parseJson(event.data);
      if (!isRec(payload) || typeof payload.name !== 'string' || !payload.name) return null;
      return { type: 'tool-result', name: payload.name, result: payload.result };
    }

    case 'error': {
      const payload = parseJson(event.data);
      // 錯誤事件一定要讓使用者知道：data 不是 JSON（例如代理層塞的純文字）也要回報，不能靜默丟掉
      if (!isRec(payload)) return { type: 'error', code: null, message: event.data.trim() };
      return {
        type: 'error',
        code: typeof payload.code === 'number' ? payload.code : null,
        message: typeof payload.message === 'string' ? payload.message : '',
      };
    }

    case 'message':
    case '': {
      if (isDoneMarker(event.data)) return { type: 'done' };
      return interpretLegacy(parseJson(event.data));
    }

    default:
      return null;
  }
}

// ── bubble reducers（皆為 immutable，回傳新 bubble） ──

function markDone(activities: ToolActivity[] | undefined): ToolActivity[] | undefined {
  return activities?.map((a) => ({ ...a, status: 'done' as const }));
}

/** 對應 Web onChunk：文字到貨時所有工具視為已完成，內容累加。 */
export function applyToken(bubble: ChatBubble, text: string): ChatBubble {
  return {
    ...bubble,
    content: bubble.content + text,
    isStreaming: true,
    toolActivities: markDone(bubble.toolActivities),
  };
}

/** 對應 Web onToolCall 的共用部分（`isDone` 由呼叫端決定）。 */
function upsertActivity(
  bubble: ChatBubble,
  name: string,
  args: unknown,
  result: unknown,
  isDone: boolean,
): ChatBubble {
  const existing = bubble.toolActivities ? [...bubble.toolActivities] : [];
  const idx = existing.findIndex((a) => a.name === name && a.status === 'running');
  const status: ToolActivity['status'] = isDone ? 'done' : 'running';

  if (idx !== -1) {
    existing[idx] = { ...existing[idx], args, result, status };
    return { ...bubble, toolActivities: existing };
  }
  return {
    ...bubble,
    toolActivities: [...(markDone(existing) ?? []), { name, args, result, status }],
  };
}

/** 新的工具呼叫：把先前仍在跑的活動標為完成，再加一筆 running；同名 running 則更新 args。 */
export function applyToolCall(bubble: ChatBubble, name: string, args: string): ChatBubble {
  return upsertActivity(bubble, name, args, undefined, false);
}

/**
 * 工具結果：對到同名 running 的活動就補上 result 並標完成（args 沿用呼叫時的）；對不到（例如 tool_call 漏掉，
 * 或已被 token 標為完成）就照 Web 的行為新增一筆已完成活動，args 取同名最近一次呼叫的 args（Web 的 customToolArgsMap），沒有則空字串。
 */
export function applyToolResult(bubble: ChatBubble, name: string, result: unknown): ChatBubble {
  const activities = bubble.toolActivities ?? [];
  const running = activities.find((a) => a.name === name && a.status === 'running');
  const lastSameName = [...activities].reverse().find((a) => a.name === name);
  const args = running?.args ?? lastSameName?.args ?? '';
  return upsertActivity(bubble, name, args, result, true);
}

/** 串流結束（含中止／出錯）：不再串流、所有工具視為完成、記錄耗時。`content` 給出錯時的預設文案。 */
export function settleBubble(
  bubble: ChatBubble,
  nowMs: number,
  startedAtMs: number,
  options?: { content?: string },
): ChatBubble {
  return {
    ...bubble,
    content: options?.content ?? bubble.content,
    isStreaming: false,
    toolActivities: markDone(bubble.toolActivities),
    thinkingMs: nowMs - startedAtMs,
  };
}

/** 便利函式：把 token／tool-call／tool-result 訊號套到 bubble；其他訊號（error／done）不改 bubble。 */
export function applyStreamSignal(bubble: ChatBubble, signal: ChatStreamSignal): ChatBubble {
  switch (signal.type) {
    case 'token':
      return applyToken(bubble, signal.text);
    case 'tool-call':
      return applyToolCall(bubble, signal.name, signal.args);
    case 'tool-result':
      return applyToolResult(bubble, signal.name, signal.result);
    default:
      return bubble;
  }
}
