// navigation feature 公開出口。HUD、步驟清單、離開確認等 UI 在 Mac 上實作時再加進來。
export { startNavigation, stopNavigation } from './controller/navigationLifecycle';
export { localRerouteCoordinator, REROUTE_COOLDOWN_MS } from './controller/localRerouteCoordinator';
export { applyRouteReplacement, handleVoiceRerouteEvent, normalizeRerouteReplacement } from './controller/rerouteCoordinator';
export type { RouteReplacement, VoiceRerouteCoordinatorEvent } from './controller/rerouteCoordinator';
export { silentSpeech, type SpeechPort } from './controller/navigationController';
export { useNavigationSession } from './hooks/useNavigationSession';
export { useNavStore } from './store/navStore';
export * from './domain';
