// 文字與語音共用同一份對話（`chatStore`）：文字請求把它當 `messages` 送，語音 `session.start` 把它當 `history` 送。
// 工具結果只回傳後端給的 `summary`（原始結果太大），後端會把它放進提示詞的「先前查詢結果」區塊。
import type { ChatBubble, ChatMessage, PriorTurn, ToolSummary } from './types';

/** 文字請求最多帶幾則訊息（後端每次都要重新處理整段歷史，越長越慢越貴）。 */
export const CHAT_HISTORY_LIMIT = 40;
/** 語音 `session.start` 最多帶幾輪（後端 `PriorHistorySchema` 上限 60、提示詞只取最後 20）。 */
export const VOICE_HISTORY_LIMIT = 20;
const SUMMARIES_PER_TURN = 8;
/** 與後端 schema 對齊（`PriorTurnSchema.text.max(4000)`、`ToolSummarySchema`）；超過整包會被丟掉或回 400。 */
export const TURN_TEXT_LIMIT = 4000;
export const TOOL_NAME_LIMIT = 64;
export const TOOL_SUMMARY_LIMIT = 1200;

/** 把摘要裁到後端接受的長度；空白摘要回 null（不送）。 */
export function clampToolSummary(name: string, summary: string | undefined): ToolSummary | null {
  const text = (summary ?? '').trim();
  if (!text) return null;
  return { name: name.slice(0, TOOL_NAME_LIMIT), summary: text.slice(0, TOOL_SUMMARY_LIMIT) };
}

/** 歷史用的對話：錯誤訊息是 App 自己的文案、不是 AI 說的話，不送回後端。 */
export interface HistoryBubble extends ChatBubble {
  isError?: boolean;
}

function summariesOf(bubble: ChatBubble): ToolSummary[] {
  return (bubble.toolActivities ?? [])
    .map((activity) => clampToolSummary(activity.name, activity.summary))
    .filter((summary): summary is ToolSummary => summary !== null)
    .slice(-SUMMARIES_PER_TURN);
}

function usable(bubble: HistoryBubble): boolean {
  if (bubble.isError) return false;
  return bubble.content.trim().length > 0 || summariesOf(bubble).length > 0;
}

/**
 * 文字請求的 `messages`：純文字的 user／assistant，assistant 附上這一輪的工具摘要（`tool_summaries`）。
 * 只取最後 `CHAT_HISTORY_LIMIT` 則，而且第一則一定是 user（後端與模型都預期由使用者起頭）。
 */
export function toChatHistory(bubbles: HistoryBubble[]): ChatMessage[] {
  const messages = bubbles.filter(usable).map((bubble): ChatMessage => {
    const tools = bubble.role === 'assistant' ? summariesOf(bubble) : [];
    return { role: bubble.role, content: bubble.content, ...(tools.length > 0 ? { tool_summaries: tools } : {}) };
  });
  const recent = messages.slice(-CHAT_HISTORY_LIMIT);
  const firstUser = recent.findIndex((message) => message.role === 'user');
  return firstUser <= 0 ? recent : recent.slice(firstUser);
}

/** 語音 `session.start.history`：最後幾輪，附工具摘要。 */
export function toPriorTurns(bubbles: HistoryBubble[]): PriorTurn[] {
  return bubbles
    .filter(usable)
    .slice(-VOICE_HISTORY_LIMIT)
    .map((bubble) => {
      const tools = bubble.role === 'assistant' ? summariesOf(bubble) : [];
      return {
        role: bubble.role,
        text: bubble.content.slice(0, TURN_TEXT_LIMIT),
        ...(tools.length > 0 ? { tools } : {}),
      };
    });
}
