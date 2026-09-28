import { fetch as expoFetch } from 'expo/fetch';

/**
 * SSE（Server-Sent Events）用戶端。移植對象是 Web `@microsoft/fetch-event-source`
 * 在本專案的用法（`src/hook/useSosLifecycle.ts` 的 `event: update` 訂閱）與
 * `src/lib/api/ai.ts` 的串流事件形狀，對應 SDD ADR-07：改用 `expo/fetch` 的
 * `ReadableStream` 自寫 parser，因為 AI chat 是 POST SSE、SOS stream 需要
 * Bearer header，原生 `EventSource` 都做不到。
 *
 * 分成兩層：
 * - `createSseParser()`：純函式狀態機，只吃字串、吐事件，不碰網路，方便單元測試。
 * - `streamSse()`：實際發request、讀 `ReadableStream`、餵給 parser 的 transport 層。
 */

export interface SseEvent {
  /** 沒有 `event:` 欄位時依 SSE 規範預設為 `"message"`。 */
  event: string;
  /** 多行 `data:` 以 `\n` 接回單一字串（規範行為）。 */
  data: string;
  id?: string;
}

interface SplitLinesResult {
  lines: string[];
  rest: string;
}

/**
 * 把 buffer 切成完整的行，並保留最後一段不完整（沒有換行結尾）的內容給下次
 * `feed` 繼續累積。特別處理 `\r\n` 被切在兩個 chunk 中間的情況：buffer 結尾
 * 若剛好是單獨的 `\r` 且後面沒有更多字元，先不切這一行，等下個 chunk 抵達
 * 才能判斷它是 `\r\n` 還是單獨的 `\r`。
 */
function splitLines(buffer: string): SplitLinesResult {
  const lines: string[] = [];
  let start = 0;
  let i = 0;
  while (i < buffer.length) {
    const ch = buffer[i];
    if (ch === '\n') {
      lines.push(buffer.slice(start, i));
      i += 1;
      start = i;
    } else if (ch === '\r') {
      if (i + 1 < buffer.length) {
        const isCrlf = buffer[i + 1] === '\n';
        lines.push(buffer.slice(start, i));
        i += isCrlf ? 2 : 1;
        start = i;
      } else {
        // 結尾是孤立的 \r，等下個 chunk 才能判斷，整段留到 rest。
        break;
      }
    } else {
      i += 1;
    }
  }
  return { lines, rest: buffer.slice(start) };
}

function parseField(line: string): { field: string; value: string } {
  const colonIndex = line.indexOf(':');
  if (colonIndex === -1) {
    return { field: line, value: '' };
  }
  const field = line.slice(0, colonIndex);
  let value = line.slice(colonIndex + 1);
  if (value.startsWith(' ')) {
    value = value.slice(1);
  }
  return { field, value };
}

export interface SseParser {
  /** 餵入新收到的（已解碼成字串的）chunk，回傳這次餵入後新完成的事件。 */
  feed: (chunk: string) => SseEvent[];
}

export function createSseParser(): SseParser {
  let buffer = '';
  let pendingEvent: string | undefined;
  let pendingDataLines: string[] = [];
  let pendingId: string | undefined;
  let hasPendingFields = false;

  function resetPending(): void {
    pendingEvent = undefined;
    pendingDataLines = [];
    pendingId = undefined;
    hasPendingFields = false;
  }

  return {
    feed(chunk: string): SseEvent[] {
      buffer += chunk;
      const { lines, rest } = splitLines(buffer);
      buffer = rest;

      const events: SseEvent[] = [];
      for (const line of lines) {
        if (line === '') {
          // 空行＝事件邊界；沒有任何欄位時（連續空行）不派發空事件。
          if (hasPendingFields) {
            events.push({
              event: pendingEvent ?? 'message',
              data: pendingDataLines.join('\n'),
              id: pendingId,
            });
          }
          resetPending();
          continue;
        }
        if (line.startsWith(':')) {
          // 註解行，忽略。
          continue;
        }
        const { field, value } = parseField(line);
        hasPendingFields = true;
        if (field === 'event') {
          pendingEvent = value;
        } else if (field === 'data') {
          pendingDataLines.push(value);
        } else if (field === 'id') {
          pendingId = value;
        }
        // 其餘欄位（如 retry）目前用不到，略過。
      }
      return events;
    },
  };
}

export interface StreamSseInit {
  method?: string;
  body?: string;
  headers?: Record<string, string>;
}

export interface StreamSseHandlers {
  onEvent: (event: SseEvent) => void;
  signal?: AbortSignal;
}

/**
 * 對 `url` 發起串流請求並持續把收到的事件丟給 `onEvent`，直到串流結束或
 * `signal` 被 abort。用 `expo/fetch`（而非 RN 全域 `fetch`）是因為只有它的
 * `Response.body` 是可讀的 `ReadableStream`（ADR-07）。
 */
export async function streamSse(
  url: string,
  init: StreamSseInit,
  handlers: StreamSseHandlers,
): Promise<void> {
  const response = await expoFetch(url, {
    method: init.method ?? 'GET',
    body: init.body,
    headers: init.headers,
    signal: handlers.signal ?? null,
  });

  const body = response.body;
  if (!body) {
    return;
  }

  const parser = createSseParser();
  const decoder = new TextDecoder();
  const reader = body.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      const text = decoder.decode(value, { stream: true });
      for (const event of parser.feed(text)) {
        handlers.onEvent(event);
      }
    }
  } finally {
    reader.releaseLock();
  }
}
