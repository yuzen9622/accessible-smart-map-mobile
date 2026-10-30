import { AudioManager, type SessionOptions } from 'react-native-audio-api';

import {
  activateVoiceAudioSession,
  beginVoiceAudio,
  currentVoiceAudioEpoch,
  releaseVoiceAudio,
  StaleAudioSessionError,
  trackAudioTeardown,
} from '../audioSession';

jest.mock('react-native-audio-api', () => ({
  AudioManager: {
    setAudioSessionOptions: jest.fn(),
    setAudioSessionActivity: jest.fn(),
  },
}));
jest.mock('@/shared/logger', () => ({ logger: { warn: jest.fn() } }));

type NativeOptions = Required<Pick<SessionOptions, 'iosCategory' | 'iosMode' | 'iosOptions'>>;
type NativeSession = { active: boolean; desired: NativeOptions; actual: NativeOptions };

const playback: NativeOptions = { iosCategory: 'playback', iosMode: 'default', iosOptions: [] };
const voice: NativeOptions = {
  iosCategory: 'playAndRecord',
  iosMode: 'voiceChat',
  iosOptions: ['allowBluetoothHFP', 'defaultToSpeaker'],
};
let session: NativeSession;

async function settleAudioTasks(): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
}

async function activateVoice(): Promise<void> {
  beginVoiceAudio();
  await activateVoiceAudioSession(currentVoiceAudioEpoch());
}

beforeEach(async () => {
  jest.mocked(AudioManager.setAudioSessionActivity).mockResolvedValue(undefined);
  releaseVoiceAudio();
  await settleAudioTasks();
  jest.clearAllMocks();
  session = {
    active: false,
    desired: playback,
    actual: { iosCategory: 'soloAmbient', iosMode: 'default', iosOptions: [] },
  };
  jest.mocked(AudioManager.setAudioSessionOptions).mockImplementation((options) => {
    session.desired = {
      iosCategory: options.iosCategory ?? 'playback',
      iosMode: options.iosMode ?? 'default',
      iosOptions: options.iosOptions ?? [],
    };
    // Native AudioSessionManager applies options immediately only while active.
    if (session.active) session.actual = session.desired;
  });
  jest.mocked(AudioManager.setAudioSessionActivity).mockImplementation(async (enabled) => {
    if (enabled) session.actual = session.desired;
    session.active = enabled;
  });
});

afterEach(async () => {
  releaseVoiceAudio();
  await settleAudioTasks();
});

it('returns both the current native mode and its next-activation options to playback after AI ends', async () => {
  await activateVoice();
  expect(session.actual).toEqual(voice);

  releaseVoiceAudio();
  await settleAudioTasks();

  expect(session.actual).toEqual(playback);
  expect(session.desired).toEqual(playback);
  expect(session.active).toBe(false);
});

it('keeps voice mode until recorder and playback teardown have completed', async () => {
  await activateVoice();
  let finishTeardown = () => {};
  trackAudioTeardown(new Promise<void>((resolve) => { finishTeardown = resolve; }));

  releaseVoiceAudio();
  await settleAudioTasks();
  expect(session.actual).toEqual(voice);
  expect(session.active).toBe(true);

  finishTeardown();
  await settleAudioTasks();
  expect(session.actual).toEqual(playback);
  expect(session.active).toBe(false);
});

it('can start another AI session and release it after a native deactivation failure', async () => {
  await activateVoice();
  jest.mocked(AudioManager.setAudioSessionActivity).mockRejectedValueOnce(new Error('audio session busy'));

  releaseVoiceAudio();
  await settleAudioTasks();
  expect(session.actual).toEqual(playback);

  await activateVoice();
  expect(session.actual).toEqual(voice);
  expect(session.active).toBe(true);

  releaseVoiceAudio();
  await settleAudioTasks();
  expect(session.actual).toEqual(playback);
  expect(session.active).toBe(false);
});

it('does not let cleanup from an earlier conversation overwrite the next conversation', async () => {
  await activateVoice();
  let finishTeardown = () => {};
  trackAudioTeardown(new Promise<void>((resolve) => { finishTeardown = resolve; }));
  releaseVoiceAudio();

  beginVoiceAudio();
  const nextActivation = activateVoiceAudioSession(currentVoiceAudioEpoch());
  await settleAudioTasks();
  expect(session.actual).toEqual(voice);

  finishTeardown();
  await nextActivation;
  await settleAudioTasks();
  expect(session.actual).toEqual(voice);
  expect(session.active).toBe(true);
});

it('rejects activation requested before the conversation ended', async () => {
  beginVoiceAudio();
  const expiredEpoch = currentVoiceAudioEpoch();
  releaseVoiceAudio();

  await expect(activateVoiceAudioSession(expiredEpoch)).rejects.toBeInstanceOf(StaleAudioSessionError);
  expect(session.active).toBe(false);
});

it('rejects an in-flight native activation when AI ends before it finishes', async () => {
  let finishActivation = () => {};
  const pendingActivation = new Promise<void>((resolve) => { finishActivation = resolve; });
  jest.mocked(AudioManager.setAudioSessionActivity).mockImplementationOnce(async (enabled) => {
    await pendingActivation;
    if (enabled) session.actual = session.desired;
    session.active = enabled;
  });
  beginVoiceAudio();
  const activation = activateVoiceAudioSession(currentVoiceAudioEpoch());
  const rejectedActivation = expect(activation).rejects.toBeInstanceOf(StaleAudioSessionError);
  await settleAudioTasks();

  releaseVoiceAudio();
  finishActivation();

  await rejectedActivation;
  await settleAudioTasks();
  expect(session.actual).toEqual(playback);
  expect(session.active).toBe(false);
});
