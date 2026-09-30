// 對應 Web `stores/__tests__/useVoiceStore.test.ts` 中屬於純 reducer 的案例：
// case 14d（toggleMute）、14e／14f（setStatus 與 isMuted）、14g（startSession 未靜音）。
// 14a／14b（單純 setter）與 14c（bindSessionActions 接線）屬於 zustand store 本體，留給 voice feature 的 store 測。
import {
  initialVoiceViewState,
  isMuteResettingStatus,
  reduceSessionBoundary,
  reduceStatus,
  reduceToggleMute,
  type VoiceViewState,
} from '../voiceViewState';

const muted: VoiceViewState = { ...initialVoiceViewState, isMuted: true };

describe('voiceViewState', () => {
  it('case 14d: isMuted defaults to false and toggles', () => {
    expect(initialVoiceViewState.isMuted).toBe(false);
    const on = reduceToggleMute(initialVoiceViewState);
    expect(on.isMuted).toBe(true);
    expect(reduceToggleMute(on).isMuted).toBe(false);
  });

  it('case 14e: reduceStatus resets isMuted on every terminal status', () => {
    for (const status of ['idle', 'ended', 'error', 'needs-login'] as const) {
      const next = reduceStatus(muted, { status });
      expect(next.isMuted).toBe(false);
      expect(next.status.status).toBe(status);
      expect(isMuteResettingStatus(status)).toBe(true);
    }
  });

  it('case 14f: reduceStatus keeps isMuted across non-terminal statuses', () => {
    for (const status of [
      'connecting',
      'ready',
      'listening',
      'model-speaking',
      'reconnecting',
      'playback-blocked',
    ] as const) {
      expect(reduceStatus(muted, { status }).isMuted).toBe(true);
      expect(isMuteResettingStatus(status)).toBe(false);
    }
  });

  it('case 14g: a session boundary (start/end) leaves the state unmuted and keeps the rest', () => {
    const next = reduceSessionBoundary({ ...muted, micLevel: 0.4, viewMode: 'pill' });
    expect(next).toEqual({ ...initialVoiceViewState, micLevel: 0.4, viewMode: 'pill', isMuted: false });
  });

  it('reducers do not mutate their input', () => {
    reduceStatus(muted, { status: 'ended' });
    reduceToggleMute(muted);
    reduceSessionBoundary(muted);
    expect(muted.isMuted).toBe(true);
  });
});
