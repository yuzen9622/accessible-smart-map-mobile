import { getAuthPort, streamSse } from '@/shared/api';
import { getAppConfig } from '@/shared/config';

import { interpretChatSseEvent, type ChatStreamSignal } from '../domain/chatStream';
import type { AgentChatRequest } from '../domain/types';

/**
 * 移植自 Web `src/lib/api/ai.ts`（`streamChatWithAgent`）。差異：
 * - 串流走 `shared/api/sse.ts`（`expo/fetch` ReadableStream，ADR-07），事件依 SSE `event:` 名稱分派
 *   （後端 `ai.chat.controller.ts` 送 `token`／`tool_call`／`tool_result`／`error`／`done`）；Web 只讀 `data:`、
 *   不處理 `error` 事件，後端回報的錯誤在 Web 會變成空白回覆。
 * - `optionalAuth` 對過期 token 回 401（不會降級成匿名）：先 refresh 一次再重送，和 `fetchRequest` 的 401 規則一致。
 * - 不送 system prompt：後端會濾掉 `role: 'system'` 並用自己的提示詞（`ai.chat.controller.ts` `rawMessages.filter`）。
 */

const CHAT = '/api/v1/ai/chat';

export class ChatHttpError extends Error {
  constructor(readonly status: number) {
    super(`AI chat failed: HTTP ${status}`);
    this.name = 'ChatHttpError';
  }
}

async function openChatStream(
  request: AgentChatRequest,
  token: string | undefined,
  onSignal: (signal: ChatStreamSignal) => void,
  signal: AbortSignal,
): Promise<void> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'text/event-stream' };
  if (token) headers.Authorization = `Bearer ${token}`;
  await streamSse(
    `${getAppConfig().apiBaseUrl}${CHAT}`,
    { method: 'POST', headers, body: JSON.stringify({ ...request, stream: true }) },
    {
      signal,
      onOpen: ({ ok, status }) => {
        if (!ok) throw new ChatHttpError(status);
      },
      onEvent: (event) => {
        const interpreted = interpretChatSseEvent(event);
        if (interpreted) onSignal(interpreted);
      },
    },
  );
}

/** 串流一次對話；`onSignal` 依序收到 token／工具事件／錯誤／done。abort 時 reject `AbortError`。 */
export async function streamChat(
  request: AgentChatRequest,
  onSignal: (signal: ChatStreamSignal) => void,
  signal: AbortSignal,
): Promise<void> {
  const port = getAuthPort();
  const captured = port.getSession();
  try {
    await openChatStream(request, captured?.accessToken, onSignal, signal);
  } catch (error) {
    if (!(error instanceof ChatHttpError) || error.status !== 401 || !captured) throw error;
    const refreshed = await port.refresh(captured);
    if (!refreshed) throw error;
    await openChatStream(request, refreshed, onSignal, signal);
  }
}
