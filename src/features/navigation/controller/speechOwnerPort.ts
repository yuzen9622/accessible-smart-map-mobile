import { useSyncExternalStore } from 'react';

/**
 * 導航播報的擁有者 port（SDD §6.7「與本機 TTS 的喇叭仲裁」，對應 Web `lib/navigation/navigationAudio.ts` 的使用端）。
 * navigation 不 import voice：語音 feature 啟動時以 `configureNavigationSpeechOwner` 注入實作
 * （同 `shared/api` 的 `configureAuthPort` 模式）；沒有語音時一律由本機 TTS 播報。
 */
export interface NavigationSpeechOwner {
  /** 語音助理（Gemini）目前是否擁有導航播報（`geminiOwnsNavigationSpeech`）。 */
  geminiOwnsSpeech(): boolean;
  /** 語音助理的輸出是否被使用者靜音（只有 `geminiOwnsSpeech` 為真時有意義）。 */
  geminiMuted(): boolean;
  /** 上面兩個值任何一個改變時通知。 */
  subscribe(onChange: () => void): () => void;
  /** HUD 喇叭鈕在語音助理擁有播報時改切換它的靜音。 */
  toggleGeminiMute(): void;
}

const localOnly: NavigationSpeechOwner = {
  geminiOwnsSpeech: () => false,
  geminiMuted: () => false,
  subscribe: () => () => {},
  toggleGeminiMute: () => {},
};

let owner: NavigationSpeechOwner = localOnly;
const listeners = new Set<() => void>();
let unsubscribeOwner: (() => void) | null = null;

function notify(): void {
  for (const listener of listeners) listener();
}

export function configureNavigationSpeechOwner(next: NavigationSpeechOwner): void {
  unsubscribeOwner?.();
  owner = next;
  unsubscribeOwner = owner.subscribe(notify);
  notify();
}

export function getNavigationSpeechOwner(): NavigationSpeechOwner {
  return owner;
}

/** 播報擁有者改變（true＝交給語音助理）；給 `NavigationController.subscribeSpeechOwner`。 */
export function subscribeSpeechOwner(onChange: (geminiOwns: boolean) => void): () => void {
  let last = owner.geminiOwnsSpeech();
  const listener = () => {
    const next = owner.geminiOwnsSpeech();
    if (next === last) return;
    last = next;
    onChange(next);
  };
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function subscribeAll(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

/** HUD 用：`{ geminiOwnsSpeech, geminiMuted }` 的 React 讀值。 */
export function useNavigationSpeechOwnerState(): { geminiOwnsSpeech: boolean; geminiMuted: boolean } {
  const geminiOwnsSpeech = useSyncExternalStore(subscribeAll, () => owner.geminiOwnsSpeech());
  const geminiMuted = useSyncExternalStore(subscribeAll, () => owner.geminiMuted());
  return { geminiOwnsSpeech, geminiMuted };
}
