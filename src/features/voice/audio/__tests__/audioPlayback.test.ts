import { createPlayback } from '../audioPlayback';

const mockQueues: {
  onBufferEnded: ((event: { bufferId: string }) => void) | null;
  enqueueBuffer: jest.Mock;
  clearBuffers: jest.Mock;
  stop: jest.Mock;
  start: jest.Mock;
  connect: jest.Mock;
}[] = [];

jest.mock('react-native-audio-api', () => ({
  AudioContext: jest.fn().mockImplementation(() => ({
    destination: {},
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
    close: jest.fn(async () => {}),
  })),
}));
jest.mock('../audioSession', () => ({ trackAudioTeardown: jest.fn() }));

beforeEach(() => { mockQueues.length = 0; });

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
