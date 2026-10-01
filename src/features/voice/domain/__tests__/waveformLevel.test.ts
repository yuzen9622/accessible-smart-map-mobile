import { GAIN, floatLevel, waveformLevel, waveformMode } from '../audioLevel';
import type { VoiceStatusName } from '../voiceSession';

describe('floatLevel', () => {
  it('空陣列與全靜音為 0', () => {
    expect(floatLevel(new Float32Array(0))).toBe(0);
    expect(floatLevel(new Float32Array(256))).toBe(0);
  });

  it('與麥克風同一個 GAIN：振幅 0.05 的方波 → 0.05 × GAIN', () => {
    const samples = new Float32Array(256).map((_, i) => (i % 2 === 0 ? 0.05 : -0.05));
    expect(floatLevel(samples)).toBeCloseTo(0.05 * GAIN, 5);
  });

  it('滿振幅 clamp 到 1、非有限值當 0', () => {
    expect(floatLevel(new Float32Array([1, -1, 1, -1]))).toBe(1);
    expect(floatLevel(new Float32Array([Number.NaN, Number.POSITIVE_INFINITY]))).toBe(0);
  });
});

describe('waveformLevel', () => {
  it('AI 說話時跟播放音量、不理麥克風回音', () => {
    expect(waveformLevel('model-speaking', 0.9, 0.3, false)).toBe(0.3);
  });

  it('聆聽時跟麥克風', () => {
    expect(waveformLevel('listening', 0.4, 0.8, false)).toBe(0.4);
  });

  it('靜音或非收音狀態一律 0', () => {
    expect(waveformLevel('listening', 0.4, 0.8, true)).toBe(0);
    const others: VoiceStatusName[] = ['idle', 'connecting', 'ready', 'reconnecting', 'playback-blocked', 'needs-login', 'ended', 'error'];
    for (const status of others) expect(waveformLevel(status, 0.5, 0.5, false)).toBe(0);
  });

  it('超出範圍與非有限值會被收斂', () => {
    expect(waveformLevel('listening', 3, 0, false)).toBe(1);
    expect(waveformLevel('listening', Number.NaN, 0, false)).toBe(0);
  });
});

describe('waveformMode', () => {
  it('連線相關狀態是待機起伏', () => {
    expect(waveformMode('connecting', false)).toBe('idle');
    expect(waveformMode('reconnecting', false)).toBe('idle');
    expect(waveformMode('ready', false)).toBe('idle');
  });

  it('收音中為 live，靜音或結束為 flat', () => {
    expect(waveformMode('listening', false)).toBe('live');
    expect(waveformMode('model-speaking', false)).toBe('live');
    expect(waveformMode('listening', true)).toBe('flat');
    expect(waveformMode('ended', false)).toBe('flat');
    expect(waveformMode('error', false)).toBe('flat');
  });
});
