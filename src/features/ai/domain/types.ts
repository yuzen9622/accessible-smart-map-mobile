// 移植自 Web `src/stores/useChatStore.ts`（ToolActivity／ChatBubble）、`src/lib/api/ai.ts`（ChatMessage／AgentChatRequest）、
// `src/types/memory.ts`（commit f5027af）。sessionStorage 持久化不搬（原生由 store 決定）。

import type { RouteContextInput, RoutingPreferences } from '@/features/route/domain';

export interface ToolActivity {
  callId?: string;
  name: string;
  args?: unknown;
  result?: unknown;
  /** 後端附在 tool_result 上的精簡摘要；對話歷史只送這個，原始結果太大（路線、地點清單）。 */
  summary?: string;
  status: 'running' | 'done';
}

export interface ChatBubble {
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
  toolActivities?: ToolActivity[];
  /** 這則回覆從送出到串流結束的耗時（毫秒），給 ThinkingTrace 顯示「已完成 3 項查詢 · 4.2 秒」。串流中為 `undefined`。 */
  thinkingMs?: number;
  /** 這則是語音對話結束後併進來的逐字稿。 */
  source?: 'voice';
}

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  name?: string;
  tool_call_id?: string;
  /** assistant 這一輪工具結果的摘要（後端 `ChatMessageSchema.tool_summaries`）。 */
  tool_summaries?: ToolSummary[];
};

/** 一筆工具結果摘要（後端 `conversation-context.ts` 的 `ToolSummary`）。 */
export interface ToolSummary {
  name: string;
  summary: string;
}

/** 語音工具結果：摘要之外保留 args／result，聊天列表照樣顯示可點的結果卡。 */
export interface VoiceTurnTool extends ToolSummary {
  args?: unknown;
  result?: unknown;
}

/** 語音結束後併進文字對話的一輪（由逐字稿與工具摘要組成）。 */
export interface VoiceTurn {
  role: 'user' | 'assistant';
  content: string;
  /** 這一輪的工具；`result` 讓聊天列表照樣顯示可點的結果卡。 */
  tools: VoiceTurnTool[];
}

/** 語音 `session.start.history` 的一輪（後端 `PriorTurnSchema`）。 */
export interface PriorTurn {
  role: 'user' | 'assistant';
  text: string;
  tools?: ToolSummary[];
}

export type AgentChatRequest = {
  language?: 'zh-TW' | 'en';
  routeContractVersion?: 1;
  routeContext?: RouteContextInput;
  routingPreferences?: RoutingPreferences;
  messages: ChatMessage[];
  model?: string;
  stream?: boolean;
  temperature?: number;
  userLocation?: { latitude: number; longitude: number };
};

export type MemoryCategory = 'preference' | 'place' | 'habit' | 'context';
export type MemorySensitivity = 'low' | 'medium' | 'high';

export interface UserMemory {
  id: string;
  content: string;
  category: MemoryCategory;
  sensitivity: MemorySensitivity;
  source: 'explicit_user' | 'agent_suggested' | 'distilled';
  createdAt: string;
  updatedAt: string;
  expiresAt: string | null;
}

export interface MemoryListResult {
  memories: UserMemory[];
}

export interface MemoryResult {
  memory: UserMemory;
}

export interface CreateMemoryBody {
  content: string;
  category: MemoryCategory;
  sensitivity?: MemorySensitivity;
  expiresAt?: string;
}

export interface UpdateMemoryBody {
  content?: string;
  category?: MemoryCategory;
  sensitivity?: MemorySensitivity;
  expiresAt?: string | null;
}

/** i18next `t` 的最小形狀；domain 不依賴 i18n 實例。 */
export type Translate = (key: string, options?: Record<string, unknown>) => string;
