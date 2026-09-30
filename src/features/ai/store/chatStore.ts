import { create } from 'zustand';

import type { ChatBubble } from '../domain/types';

/** 畫面用的一則訊息：domain `ChatBubble` 加上列表 key 與路線動作的結果提示。 */
export interface ChatEntry extends ChatBubble {
  id: string;
  /** 工具要求的路線動作沒成功時，附在這則回覆下的提示（SDD §6.6：async action 要回報結果）。 */
  notice?: string;
  /** 這則是錯誤訊息（連線失敗、後端 `error` 事件）而不是 AI 的回答。 */
  isError?: boolean;
}

interface ChatState {
  entries: ChatEntry[];
  isLoading: boolean;
}

/**
 * 聊天紀錄只放記憶體（SDD §6.6／§7.3：對應 Web sessionStorage，App 生命週期內保留、冷啟動清除）。
 * 寫入只經過 `controller/chatController.ts`；UI 只讀。
 */
export const useChatStore = create<ChatState>(() => ({ entries: [], isLoading: false }));
