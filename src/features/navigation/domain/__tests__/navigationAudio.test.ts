// 移植自 Web `src/lib/navigation/__tests__/navigationAudio.test.ts`（commit 5eadc71），純函式案例逐一保留。
import { geminiOwnsNavigationSpeech, isNavigationAudioActive, resolveNavigationAudioToggle, shouldSpeakLocally } from '../navigationAudio';
import type { VoiceStatusName } from '../types';

const LIVE_STATUSES: VoiceStatusName[] = [
  'ready',
  'listening',
  'model-speaking',
  'playback-blocked',
];

const NON_LIVE_STATUSES: VoiceStatusName[] = [
  'idle',
  'connecting',
  'reconnecting',
  'needs-login',
  'ended',
  'error',
];

describe('geminiOwnsNavigationSpeech', () => {
  it('requires both the navigation and a channel that can carry speech', () => {
    for (const status of LIVE_STATUSES) {
      expect(geminiOwnsNavigationSpeech('voice', status)).toBe(true);
      // A background voice session must never silence a local navigation.
      expect(geminiOwnsNavigationSpeech('local', status)).toBe(false);
    }
    for (const status of NON_LIVE_STATUSES) {
      expect(geminiOwnsNavigationSpeech('voice', status)).toBe(false);
      expect(geminiOwnsNavigationSpeech('local', status)).toBe(false);
    }
  });
});

describe('shouldSpeakLocally', () => {
  it('never doubles up on a live Gemini channel', () => {
    expect(
      shouldSpeakLocally({ geminiOwnsSpeech: true, localVoiceEnabled: true }),
    ).toBe(false);
  });

  it('speaks whenever the local engine owns the navigation and voice is on', () => {
    expect(
      shouldSpeakLocally({ geminiOwnsSpeech: false, localVoiceEnabled: true }),
    ).toBe(true);
  });

  it('stays silent when the user disabled local voice', () => {
    expect(
      shouldSpeakLocally({ geminiOwnsSpeech: false, localVoiceEnabled: false }),
    ).toBe(false);
  });
});

describe('isNavigationAudioActive', () => {
  it('reads the mute flag while Gemini owns the channel', () => {
    expect(
      isNavigationAudioActive({
        geminiOwnsSpeech: true,
        geminiMuted: false,
        localVoiceEnabled: false,
      }),
    ).toBe(true);
    expect(
      isNavigationAudioActive({
        geminiOwnsSpeech: true,
        geminiMuted: true,
        localVoiceEnabled: true,
      }),
    ).toBe(false);
  });

  it('reads the local toggle otherwise, ignoring a muted background session', () => {
    expect(
      isNavigationAudioActive({
        geminiOwnsSpeech: false,
        geminiMuted: true,
        localVoiceEnabled: true,
      }),
    ).toBe(true);
  });
});

describe('resolveNavigationAudioToggle', () => {
  it('drives the Gemini mute while it owns the channel', () => {
    expect(
      resolveNavigationAudioToggle({
        geminiOwnsSpeech: true,
        geminiMuted: false,
        localVoiceEnabled: false,
      }),
    ).toEqual({ target: 'gemini', nextActive: false });
    expect(
      resolveNavigationAudioToggle({
        geminiOwnsSpeech: true,
        geminiMuted: true,
        localVoiceEnabled: false,
      }),
    ).toEqual({ target: 'gemini', nextActive: true });
  });

  it('drives the local toggle otherwise, leaving the mute untouched', () => {
    expect(
      resolveNavigationAudioToggle({
        geminiOwnsSpeech: false,
        geminiMuted: true,
        localVoiceEnabled: false,
      }),
    ).toEqual({ target: 'local', nextActive: true });
  });
});

// Web 檔尾的「the speaker button against the real stores」區塊依賴語音 store（useVoiceStore），
// 隨 Phase 4 語音 feature 一起移植（見 port-ledger）。
