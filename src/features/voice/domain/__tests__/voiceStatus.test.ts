// 新寫（Web 沒有對應測試）：VoiceFloatingIndicator 的純函式。
import { t } from '../testing/translate';
import { getVoiceStatusLabel, isTerminalVoiceStatus, isVoiceSessionActive, shouldShowVoicePill } from '../voiceStatus';
import type { VoiceStatus, VoiceStatusName } from '../voiceSession';

const ALL: VoiceStatusName[] = [
  'idle',
  'connecting',
  'ready',
  'listening',
  'model-speaking',
  'reconnecting',
  'playback-blocked',
  'needs-login',
  'ended',
  'error',
];

describe('isVoiceSessionActive', () => {
  it('is false only for idle and ended', () => {
    expect(ALL.filter((s) => !isVoiceSessionActive(s))).toEqual(['idle', 'ended']);
  });
});

describe('shouldShowVoicePill', () => {
  it('hides while the voice panel is on screen, shows when chat is closed or in pill mode', () => {
    expect(shouldShowVoicePill('listening', true, 'panel')).toBe(false);
    expect(shouldShowVoicePill('listening', false, 'panel')).toBe(true);
    expect(shouldShowVoicePill('listening', true, 'pill')).toBe(true);
  });

  it('never shows for an inactive session', () => {
    expect(shouldShowVoicePill('idle', false, 'pill')).toBe(false);
    expect(shouldShowVoicePill('ended', false, 'pill')).toBe(false);
  });
});

describe('isTerminalVoiceStatus', () => {
  it('is true for needs-login and error only', () => {
    expect(ALL.filter(isTerminalVoiceStatus)).toEqual(['needs-login', 'error']);
  });
});

describe('getVoiceStatusLabel', () => {
  it('maps every status to an existing zh-TW string (t throws on a missing key)', () => {
    for (const status of ALL) {
      expect(getVoiceStatusLabel({ status }, t).length).toBeGreaterThan(0);
    }
  });

  it('uses close-code specific copy for error', () => {
    const label = (s: VoiceStatus) => getVoiceStatusLabel(s, t);
    expect(label({ status: 'error', code: 4409 })).toBe('已在其他裝置開啟語音對話');
    expect(label({ status: 'error', code: 'LIVE_SESSION_ENDED' })).toBe('對話已逾時，請重新開始');
    expect(label({ status: 'error', code: 1011 })).toBe('語音暫時無法使用');
    expect(label({ status: 'error', code: 'MIC_UNAVAILABLE' })).toBe('無法使用麥克風');
    expect(label({ status: 'error', code: 4408 })).toBe('發生錯誤，請稍後再試');
    expect(label({ status: 'error' })).toBe('發生錯誤，請稍後再試');
  });
});
