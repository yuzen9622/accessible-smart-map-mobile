// AI 助理（SDD §6.6）的公開出口。聊天與語音共用 action executor（雙路徑不變量）。
export { getRouteConversationRequest } from './controller/routeConversation';
export { default as ChatScreen } from './screens/ChatScreen';
export { default as AiMemoryScreen } from './screens/AiMemoryScreen';
export { default as AIResultLayer } from './components/AIResultLayer';
export { default as RouteExplanationCard } from './components/RouteExplanationCard';
export {
  appendVoiceTurns,
  clearChat,
  getVoiceHistory,
  sendChatMessage,
  stopChatStreaming,
} from './controller/chatController';
export { closeChat, executeAction, openRoutePanel } from './controller/actionExecutor';
export { useChatStore, type ChatEntry } from './store/chatStore';
export { useAiBootstrap } from './hooks/useAiBootstrap';

// 純邏輯；其他 feature 的 domain 層請直接從 `@/features/ai/domain` 引用。
export * from './domain';
