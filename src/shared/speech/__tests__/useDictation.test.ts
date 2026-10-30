import { act, renderHook } from '@testing-library/react-native';
import { PermissionStatus } from 'expo-modules-core';
import { ExpoSpeechRecognitionModule, type ExpoSpeechRecognitionNativeEventMap } from 'expo-speech-recognition';
import type { EventEmitter } from 'events';

import { useDictation } from '../useDictation';

jest.mock('expo-speech-recognition', () => {
  const { EventEmitter } = jest.requireActual<typeof import('events')>('events');
  const { useEffect } = jest.requireActual<typeof import('react')>('react');
  const events = new EventEmitter();
  return {
    __events: events,
    ExpoSpeechRecognitionModule: {
      requestPermissionsAsync: jest.fn(),
      start: jest.fn(),
      stop: jest.fn(),
      abort: jest.fn(),
    },
    useSpeechRecognitionEvent: <K extends keyof ExpoSpeechRecognitionNativeEventMap>(
      eventName: K,
      listener: (event: ExpoSpeechRecognitionNativeEventMap[K]) => void,
    ) => {
      useEffect(() => {
        events.on(eventName, listener);
        return () => { events.removeListener(eventName, listener); };
      }, [eventName, listener]);
    },
  };
});

const { __events: nativeEvents } = jest.requireMock<{ __events: EventEmitter }>('expo-speech-recognition');
type Permission = Awaited<ReturnType<typeof ExpoSpeechRecognitionModule.requestPermissionsAsync>>;
const grantedPermission: Permission = {
  granted: true, status: PermissionStatus.GRANTED, canAskAgain: true, expires: 'never', restricted: false,
};

function pendingPermission() {
  let resolve: (permission: Permission) => void = () => {};
  const promise = new Promise<Permission>((finish) => { resolve = finish; });
  return { promise, resolve };
}

function resultEvent(transcript: string, isFinal = true): ExpoSpeechRecognitionNativeEventMap['result'] {
  return { isFinal, results: [{ transcript, confidence: 1, segments: [] }] };
}

async function emit<K extends keyof ExpoSpeechRecognitionNativeEventMap>(
  eventName: K,
  event: ExpoSpeechRecognitionNativeEventMap[K],
) {
  await act(() => { nativeEvents.emit(eventName, event); });
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(ExpoSpeechRecognitionModule.requestPermissionsAsync).mockResolvedValue(grantedPermission);
});

it('shows starting while permissions and the native recognizer are pending, then listens only on the native start event', async () => {
  const permission = pendingPermission();
  jest.mocked(ExpoSpeechRecognitionModule.requestPermissionsAsync).mockReturnValue(permission.promise);
  const { result } = await renderHook(() => useDictation(jest.fn()));
  let starting = Promise.resolve();
  await act(() => { starting = result.current.start(); });
  expect(result.current.status).toBe('starting');
  expect(ExpoSpeechRecognitionModule.start).not.toHaveBeenCalled();
  await act(async () => { permission.resolve(grantedPermission); await starting; });
  expect(ExpoSpeechRecognitionModule.start).toHaveBeenCalledTimes(1);
  expect(result.current.status).toBe('starting');
  await emit('start', null);
  expect(result.current.status).toBe('listening');
});

it('keeps a native startup failure visible after the following end event', async () => {
  const { result } = await renderHook(() => useDictation(jest.fn()));
  await act(async () => { await result.current.start(); });
  await emit('error', { error: 'service-not-allowed', message: 'Recognizer is unavailable' });
  await emit('end', null);
  expect(result.current.status).toBe('error');
});

it('does not start recognition when permission is denied', async () => {
  jest.mocked(ExpoSpeechRecognitionModule.requestPermissionsAsync).mockResolvedValue({
    ...grantedPermission, granted: false, status: PermissionStatus.DENIED, canAskAgain: false,
  });
  const { result } = await renderHook(() => useDictation(jest.fn()));
  await act(async () => { await result.current.start(); });
  expect(result.current.status).toBe('denied');
  expect(ExpoSpeechRecognitionModule.start).not.toHaveBeenCalled();
});

it('returns only final, nonempty trimmed transcripts', async () => {
  const onResult = jest.fn();
  const { result } = await renderHook(() => useDictation(onResult));
  await act(async () => { await result.current.start(); });
  await emit('start', null);
  await emit('result', resultEvent('臺北', false));
  await emit('result', resultEvent('   ', true));
  expect(onResult).not.toHaveBeenCalled();
  await emit('result', resultEvent('  臺北車站  ', true));
  expect(onResult).toHaveBeenCalledTimes(1);
  expect(onResult).toHaveBeenCalledWith('臺北車站');
});

it('returns to idle when the native recognizer ends before or after listening starts', async () => {
  const { result } = await renderHook(() => useDictation(jest.fn()));
  await act(async () => { await result.current.start(); });
  await emit('end', null);
  expect(result.current.status).toBe('idle');
  await act(async () => { await result.current.start(); });
  await emit('start', null);
  await emit('end', null);
  expect(result.current.status).toBe('idle');
});

it('does not start a second recognizer for repeated taps while permission is pending', async () => {
  const permission = pendingPermission();
  jest.mocked(ExpoSpeechRecognitionModule.requestPermissionsAsync).mockReturnValue(permission.promise);
  const { result } = await renderHook(() => useDictation(jest.fn()));
  let firstStart = Promise.resolve();
  let secondStart = Promise.resolve();
  await act(() => {
    firstStart = result.current.start();
    secondStart = result.current.start();
  });
  expect(ExpoSpeechRecognitionModule.requestPermissionsAsync).toHaveBeenCalledTimes(1);
  await act(async () => { permission.resolve(grantedPermission); await Promise.all([firstStart, secondStart]); });
  expect(ExpoSpeechRecognitionModule.start).toHaveBeenCalledTimes(1);
});

it('does not start late after the user stops during the permission prompt', async () => {
  const permission = pendingPermission();
  jest.mocked(ExpoSpeechRecognitionModule.requestPermissionsAsync).mockReturnValue(permission.promise);
  const { result } = await renderHook(() => useDictation(jest.fn()));
  let starting = Promise.resolve();
  await act(() => { starting = result.current.start(); });
  await act(() => { result.current.stop(); });
  await act(async () => { permission.resolve(grantedPermission); await starting; });
  expect(ExpoSpeechRecognitionModule.start).not.toHaveBeenCalled();
  expect(result.current.status).toBe('idle');
});

it('does not start late after unmounting during the permission prompt', async () => {
  const permission = pendingPermission();
  jest.mocked(ExpoSpeechRecognitionModule.requestPermissionsAsync).mockReturnValue(permission.promise);
  const { result, unmount } = await renderHook(() => useDictation(jest.fn()));
  let starting = Promise.resolve();
  await act(() => { starting = result.current.start(); });
  await unmount();
  await act(async () => { permission.resolve(grantedPermission); await starting; });
  expect(ExpoSpeechRecognitionModule.start).not.toHaveBeenCalled();
});

it('discards a late final transcript after cancelling recognition', async () => {
  const onResult = jest.fn();
  const { result } = await renderHook(() => useDictation(onResult));
  await act(async () => { await result.current.start(); });
  await emit('start', null);
  await act(() => { result.current.cancel(); });
  expect(ExpoSpeechRecognitionModule.abort).toHaveBeenCalledTimes(1);
  expect(result.current.status).toBe('idle');
  await emit('result', resultEvent('臺北車站'));
  await emit('end', null);
  expect(onResult).not.toHaveBeenCalled();
  expect(result.current.status).toBe('idle');
});

it('does not start late after cancelling during the permission prompt', async () => {
  const permission = pendingPermission();
  jest.mocked(ExpoSpeechRecognitionModule.requestPermissionsAsync).mockReturnValue(permission.promise);
  const { result } = await renderHook(() => useDictation(jest.fn()));
  let starting = Promise.resolve();
  await act(() => { starting = result.current.start(); });
  await act(() => { result.current.cancel(); });
  await act(async () => { permission.resolve(grantedPermission); await starting; });
  expect(ExpoSpeechRecognitionModule.start).not.toHaveBeenCalled();
  expect(ExpoSpeechRecognitionModule.abort).not.toHaveBeenCalled();
  expect(result.current.status).toBe('idle');
});

it('waits for the cancelled native session to end before starting an immediate retry', async () => {
  const { result } = await renderHook(() => useDictation(jest.fn()));
  await act(async () => { await result.current.start(); });
  await emit('start', null);
  await act(() => { result.current.cancel(); });
  let restarting = Promise.resolve();
  await act(() => { restarting = result.current.start(); });
  expect(result.current.status).toBe('starting');
  expect(ExpoSpeechRecognitionModule.requestPermissionsAsync).toHaveBeenCalledTimes(1);
  expect(ExpoSpeechRecognitionModule.start).toHaveBeenCalledTimes(1);
  await emit('error', { error: 'aborted', message: 'Speech recognition aborted.' });
  expect(result.current.status).toBe('starting');
  await emit('end', null);
  await act(async () => { await restarting; });
  expect(ExpoSpeechRecognitionModule.requestPermissionsAsync).toHaveBeenCalledTimes(2);
  expect(ExpoSpeechRecognitionModule.start).toHaveBeenCalledTimes(2);
  expect(result.current.status).toBe('starting');
  await emit('start', null);
  expect(result.current.status).toBe('listening');
});

it('still delivers the final transcript when stopping to finish dictation', async () => {
  const onResult = jest.fn();
  const { result } = await renderHook(() => useDictation(onResult));
  await act(async () => { await result.current.start(); });
  await emit('start', null);
  await act(() => { result.current.stop(); });
  expect(ExpoSpeechRecognitionModule.stop).toHaveBeenCalledTimes(1);
  await emit('result', resultEvent('  臺北車站  '));
  await emit('end', null);
  expect(onResult).toHaveBeenCalledTimes(1);
  expect(onResult).toHaveBeenCalledWith('臺北車站');
  expect(result.current.status).toBe('idle');
});

it('only aborts recognition on unmount when this hook started an active session', async () => {
  const idle = await renderHook(() => useDictation(jest.fn()));
  await idle.unmount();
  expect(ExpoSpeechRecognitionModule.abort).not.toHaveBeenCalled();
  const active = await renderHook(() => useDictation(jest.fn()));
  await act(async () => { await active.result.current.start(); });
  await emit('start', null);
  await active.unmount();
  expect(ExpoSpeechRecognitionModule.abort).toHaveBeenCalledTimes(1);
});
