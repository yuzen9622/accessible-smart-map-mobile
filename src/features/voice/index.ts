// 語音助理（SDD §6.7）的公開出口。
export { default as VoiceModeView } from './components/VoiceModeView';
export { default as VoiceMicButton } from './components/VoiceMicButton';
export { default as VoiceFloatingIndicator } from './components/VoiceFloatingIndicator';
export { endVoiceSession, startVoiceSession } from './controller/voiceController';
export { useVoiceStore } from './store/voiceStore';

// 純邏輯；其他 feature 的 domain 層請直接從 `@/features/voice/domain` 引用。
export * from './domain';
