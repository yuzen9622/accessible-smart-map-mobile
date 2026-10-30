import { createPlayback } from '../audioPlayback';
import { AudioContext } from 'react-native-audio-api';
import { ECHO_TAIL_MS } from '../../domain/echoGate';
import { trackAudioTeardown } from '../audioSession';

const mockQueues: {
  onBufferEnded: ((event: { bufferId: string }) => void) | null;
  enqueueBuffer: jest.Mock;
  clearBuffers: jest.Mock;
  stop: jest.Mock;
  start: jest.Mock;
  connect: jest.Mock;
}[] = [];
const mockCueSources: {
  onEnded: (() => void) | null;
  buffer: unknown;
  start: jest.Mock;
  stop: jest.Mock;
  connect: jest.Mock;
  disconnect: jest.Mock;
}[] = [];
const mockDecode = jest.fn<Promise<{ duration: number }>, [unknown]>(() => Promise.resolve({ duration: 0.56 }));
const mockClose = jest.fn(async () => {});

jest.mock('react-native-audio-api', () => ({
  AudioContext: jest.fn().mockImplementation(() => ({
    destination: {},
    decodeAudioData: (source: unknown) => mockDecode(source),
    createBufferSource: () => {
      const source = {
        onEnded: null, buffer: null,
        start: jest.fn(), stop: jest.fn(), connect: jest.fn(), disconnect: jest.fn(),
      };
      mockCueSources.push(source);
      return source;
    },
    createAnalyser: () => ({ connect: jest.fn() }),
    createBuffer: () => ({ copyToChannel: jest.fn() }),
    createBufferQueueSource: () => {
      let id = 0;
      const queue = {
        onBufferEnded: null,
        enqueueBuffer: jest.fn(() => String(++id)),
        clearBuffers: jest.fn(), stop: jest.fn(), start: jest.fn(), connect: jest.fn(),
      };
      mockQueues.push(queue);
      return queue;
    },
    close: () => mockClose(),
  })),
}));
jest.mock('../audioSession', () => ({ trackAudioTeardown: jest.fn() }));
jest.mock('@/shared/logger', () => ({ logger: { warn: jest.fn() } }));

beforeEach(() => {
  jest.clearAllMocks();
  mockQueues.length = 0;
  mockCueSources.length = 0;
  mockDecode.mockReset().mockResolvedValue({ duration: 0.56 });
});

it('waits for every enqueued buffer, including a chunk added before a delayed end callback', () => {
  const playback = createPlayback(); const drained = jest.fn();
  playback.onDrained?.(drained);
  playback.play(new ArrayBuffer(8));
  const queue = mockQueues[0];
  playback.play(new ArrayBuffer(8));
  queue.onBufferEnded?.({ bufferId: '1' });
  expect(playback.isPlaying?.()).toBe(true);
  expect(drained).not.toHaveBeenCalled();
  queue.onBufferEnded?.({ bufferId: '2' });
  expect(playback.isPlaying?.()).toBe(false);
  expect(drained).toHaveBeenCalledTimes(1);
  playback.dispose();
});

it('ignores stale native callbacks after interruption and queue replacement', () => {
  const playback = createPlayback(); const drained = jest.fn();
  playback.onDrained?.(drained);
  playback.play(new ArrayBuffer(8));
  const stale = mockQueues[0].onBufferEnded;
  playback.clear();
  expect(playback.isPlaying?.()).toBe(false);
  playback.play(new ArrayBuffer(8));
  stale?.({ bufferId: '1' });
  expect(playback.isPlaying?.()).toBe(true);
  expect(drained).not.toHaveBeenCalled();
  mockQueues[1].onBufferEnded?.({ bufferId: '1' });
  expect(drained).toHaveBeenCalledTimes(1);
  playback.dispose();
});

describe('session cues', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); });

  it('holds the start cue through its actual end and echo tail without completing a model turn', async () => {
    const activity = jest.fn(); const scheduled = jest.fn(); const drained = jest.fn();
    const playback = createPlayback({ onCueActivity: activity, onScheduled: scheduled });
    playback.onDrained?.(drained);
    const complete = jest.fn();
    const cue = playback.playCue?.('start').then(complete);
    await Promise.resolve();
    expect(mockCueSources[0].start).toHaveBeenCalledWith(0, 0);
    expect(activity.mock.calls).toEqual([[true]]);
    expect(scheduled).toHaveBeenCalledWith(560);
    expect(playback.isPlaying?.()).toBe(false);
    expect(complete).not.toHaveBeenCalled();

    mockCueSources[0].onEnded?.();
    await jest.advanceTimersByTimeAsync(ECHO_TAIL_MS - 1);
    expect(complete).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(1);
    await cue;
    expect(activity.mock.calls).toEqual([[true], [false]]);
    expect(complete).toHaveBeenCalledTimes(1);
    expect(drained).not.toHaveBeenCalled();
    expect(mockClose).not.toHaveBeenCalled();
    playback.dispose();
  });

  it('buffers model frames during cue decoding, playback and tail, then uses the same context', async () => {
    const playback = createPlayback(); const drained = jest.fn();
    playback.onDrained?.(drained);
    const cue = playback.playCue?.('start');
    playback.play(new ArrayBuffer(8));
    expect(playback.isPlaying?.()).toBe(true);
    expect(mockQueues).toHaveLength(0);
    await Promise.resolve();
    playback.play(new ArrayBuffer(8));
    mockCueSources[0].onEnded?.();
    await jest.advanceTimersByTimeAsync(ECHO_TAIL_MS);
    await cue;
    expect(AudioContext).toHaveBeenCalledTimes(1);
    expect(mockQueues).toHaveLength(1);
    expect(mockQueues[0].enqueueBuffer).toHaveBeenCalledTimes(2);
    expect(drained).not.toHaveBeenCalled();
    mockQueues[0].onBufferEnded?.({ bufferId: '1' });
    mockQueues[0].onBufferEnded?.({ bufferId: '2' });
    expect(drained).toHaveBeenCalledTimes(1);
    playback.dispose();
  });

  it('finishes the end cue before its caller disposes the playback context', async () => {
    const playback = createPlayback();
    const complete = playback.playCue?.('end');
    await Promise.resolve();
    expect(mockClose).not.toHaveBeenCalled();
    mockCueSources[0].onEnded?.();
    await complete;
    expect(jest.getTimerCount()).toBe(0);
    expect(mockClose).not.toHaveBeenCalled();
    playback.dispose();
    expect(mockCueSources[0].disconnect).toHaveBeenCalled();
    expect(mockClose).toHaveBeenCalledTimes(1);
    expect(trackAudioTeardown).toHaveBeenCalledTimes(1);
  });

  it('recovers from decode failure and releases buffered model audio', async () => {
    mockDecode.mockRejectedValueOnce(new Error('invalid sound'));
    const activity = jest.fn();
    const playback = createPlayback({ onCueActivity: activity });
    const cue = playback.playCue?.('start');
    playback.play(new ArrayBuffer(8));
    await cue;
    expect(activity.mock.calls).toEqual([[true], [false]]);
    expect(mockCueSources).toHaveLength(0);
    expect(mockQueues[0].enqueueBuffer).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
    playback.dispose();
  });

  it.each(['clear', 'dispose'] as const)('cancels pending decoding and queued model frames without reviving after %s', async action => {
    let finishDecode = (_value: { duration: number }) => {};
    mockDecode.mockReturnValueOnce(new Promise(resolve => { finishDecode = resolve; }));
    const activity = jest.fn();
    const playback = createPlayback({ onCueActivity: activity });
    const cue = playback.playCue?.('start');
    playback.play(new ArrayBuffer(8));
    playback[action]();
    await cue;
    finishDecode({ duration: 0.56 });
    await Promise.resolve();
    expect(mockCueSources).toHaveLength(0);
    expect(mockQueues).toHaveLength(0);
    expect(playback.isPlaying?.()).toBe(false);
    expect(activity.mock.calls).toEqual([[true], [false]]);
    expect(jest.getTimerCount()).toBe(0);
    playback.dispose();
  });

  it('disconnects the cue and settles even if native stop rejects cleanup', async () => {
    const playback = createPlayback();
    const cue = playback.playCue?.('end');
    await Promise.resolve();
    mockCueSources[0].stop.mockImplementationOnce(() => { throw new Error('already ended'); });
    mockCueSources[0].onEnded?.();
    await cue;
    expect(mockCueSources[0].disconnect).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
    playback.dispose();
  });

  it('ignores decoding from a replaced cue while keeping the new cue active', async () => {
    let finishDecode = (_value: { duration: number }) => {};
    mockDecode.mockReturnValueOnce(new Promise(resolve => { finishDecode = resolve; }));
    const activity = jest.fn();
    const playback = createPlayback({ onCueActivity: activity });
    const start = playback.playCue?.('start');
    const end = playback.playCue?.('end');
    await start;
    finishDecode({ duration: 0.56 });
    await Promise.resolve();
    expect(mockCueSources).toHaveLength(1);
    expect(activity.mock.calls).toEqual([[true], [false], [true]]);
    mockCueSources[0].onEnded?.();
    await end;
    expect(activity.mock.calls).toEqual([[true], [false], [true], [false]]);
    playback.dispose();
  });

  it.each(['decode', 'ended'] as const)('bounds an unresponsive native %s operation', async phase => {
    if (phase === 'decode') mockDecode.mockReturnValueOnce(new Promise(() => {}));
    const activity = jest.fn();
    const playback = createPlayback({ onCueActivity: activity });
    const cue = playback.playCue?.('start');
    playback.play(new ArrayBuffer(8));
    await jest.advanceTimersByTimeAsync(2000);
    await cue;
    expect(activity.mock.calls).toEqual([[true], [false]]);
    if (phase === 'ended') expect(mockCueSources[0].stop).toHaveBeenCalled();
    expect(mockQueues[0].enqueueBuffer).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
    playback.dispose();
  });

  it('cancels playback on dispose and never opens another context from late calls', async () => {
    const activity = jest.fn();
    const playback = createPlayback({ onCueActivity: activity });
    const cue = playback.playCue?.('end');
    await Promise.resolve();
    const lateEnded = mockCueSources[0].onEnded;
    playback.dispose();
    await cue;
    lateEnded?.();
    playback.play(new ArrayBuffer(8));
    await playback.playCue?.('start');
    expect(activity.mock.calls).toEqual([[true], [false]]);
    expect(mockCueSources[0].stop).toHaveBeenCalledTimes(1);
    expect(mockQueues).toHaveLength(0);
    expect(AudioContext).toHaveBeenCalledTimes(1);
    expect(mockClose).toHaveBeenCalledTimes(1);
  });

  it('mutes model audio while allowing the independent session cue to complete', async () => {
    const playback = createPlayback();
    const cue = playback.playCue?.('end');
    playback.play(new ArrayBuffer(8));
    await Promise.resolve();
    playback.setMuted?.(true);
    expect(mockCueSources[0].stop).not.toHaveBeenCalled();
    mockCueSources[0].onEnded?.();
    await cue;
    expect(mockQueues).toHaveLength(0);
    expect(playback.isPlaying?.()).toBe(false);
    playback.dispose();
  });
});
