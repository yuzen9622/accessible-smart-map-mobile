// 移植自 Web `src/stores/useChatStore.ts`（ToolActivity／ChatBubble）、`src/lib/api/ai.ts`（ChatMessage／AgentChatRequest）、
// `src/types/memory.ts`（commit f5027af）。sessionStorage 持久化不搬（原生由 store 決定）。

export interface ToolActivity {
  name: string;
  args?: unknown;
  result?: unknown;
  status: 'running' | 'done';
}

export interface ChatBubble {
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
  toolActivities?: ToolActivity[];
  /** 這則回覆從送出到串流結束的耗時（毫秒），給 ThinkingTrace 顯示「已完成 3 項查詢 · 4.2 秒」。串流中為 `undefined`。 */
  thinkingMs?: number;
}

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  name?: string;
  tool_call_id?: string;
};

export type AgentChatRequest = {
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
