import { useEffect } from 'react';

import { onLogout } from '@/features/auth';

import { clearChat } from '../controller/chatController';

/** 登出時清掉聊天紀錄與地圖上的 AI 結果（對齊 Web：logout → `useChatStore.clearAll`）。 */
export function useAiBootstrap(): void {
  useEffect(() => onLogout(() => clearChat()), []);
}
