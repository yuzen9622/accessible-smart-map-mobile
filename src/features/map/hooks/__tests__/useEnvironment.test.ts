import { act, renderHook } from '@testing-library/react-native';

import { fetchRequest, type ApiResponse } from '@/shared/api';
import { useEnvironment } from '../useEnvironment';
import { useEnvironmentStore } from '../../store/environmentStore';
import { useUserLocationStore } from '../../store/userLocationStore';

let mockActive = true;
let mockVisibilityChange: ((active: boolean) => void) | undefined;
jest.mock('@/shared/api', () => ({ fetchRequest: jest.fn() }));
jest.mock('@/shared/logger', () => ({ logger: { warn: jest.fn() } }));
jest.mock('@/shared/polling', () => ({
  ...jest.requireActual('@/shared/polling'),
  appStateVisibility: {
    isActive: () => mockActive,
    subscribe: (listener: (active: boolean) => void) => {
      mockVisibilityChange = listener;
      return () => { mockVisibilityChange = undefined; };
    },
  },
}));

const request = jest.mocked(fetchRequest);
const weather = { status: 'ok', temperature: 24, precipitationProbability: 10, condition: '晴' };
const airQuality = { status: 'ok', pm25: 10, quality: '良好', advice: null };
const response: ApiResponse<unknown> = {
  ok: true, status: 'success', code: 200, message: '', data: { weather, airQuality },
};

beforeEach(() => {
  jest.useFakeTimers();
  request.mockReset();
  mockActive = true;
  mockVisibilityChange = undefined;
  useEnvironmentStore.setState({ info: null });
  useUserLocationStore.setState({ position: { lat: 25.0478, lng: 121.5170 } });
});

afterEach(() => { jest.useRealTimers(); });

it('recovers from a failed first request without moving the user', async () => {
  request.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(response);
  const hook = await renderHook(() => useEnvironment());
  expect(useEnvironmentStore.getState().info).toBeNull();
  await act(async () => { await jest.advanceTimersByTimeAsync(60_000); });
  expect(request).toHaveBeenCalledTimes(2);
  expect(useEnvironmentStore.getState().info?.weather).toEqual(weather);
  await hook.unmount();
});

it('retries when both upstream sources were unavailable', async () => {
  request.mockResolvedValueOnce({ ...response, data: {
    weather: { status: 'unavailable' }, airQuality: { status: 'unavailable' },
  } }).mockResolvedValueOnce(response);
  const hook = await renderHook(() => useEnvironment());
  expect(useEnvironmentStore.getState().info?.weather.status).toBe('unavailable');
  await act(async () => { await jest.advanceTimersByTimeAsync(60_000); });
  expect(useEnvironmentStore.getState().info?.weather).toEqual(weather);
  await hook.unmount();
});

it('pauses in the background and refreshes immediately on returning to the app', async () => {
  mockActive = false;
  request.mockResolvedValue(response);
  const hook = await renderHook(() => useEnvironment());
  await act(async () => { await jest.advanceTimersByTimeAsync(120_000); });
  expect(request).not.toHaveBeenCalled();
  await act(() => { mockActive = true; mockVisibilityChange?.(true); });
  expect(request).toHaveBeenCalledTimes(1);
  expect(useEnvironmentStore.getState().info?.weather).toEqual(weather);
  await hook.unmount();
});

it('keeps the last successful data after a refresh network error', async () => {
  request.mockResolvedValueOnce(response).mockRejectedValueOnce(new Error('offline'));
  const hook = await renderHook(() => useEnvironment());
  await act(async () => { await jest.advanceTimersByTimeAsync(60_000); });
  expect(useEnvironmentStore.getState().info).toEqual({ weather, airQuality });
  await hook.unmount();
});

it('ignores a late response from the old location and stops polling after unmount', async () => {
  const oldResponse = Promise.withResolvers<ApiResponse<unknown>>();
  request.mockImplementationOnce(() => oldResponse.promise).mockResolvedValueOnce(response);
  const hook = await renderHook(() => useEnvironment());
  const oldSignal = request.mock.calls[0]?.[1]?.signal;
  await act(() => useUserLocationStore.getState().setPosition({ lat: 25.06, lng: 121.52 }));
  expect(oldSignal?.aborted).toBe(true);
  expect(useEnvironmentStore.getState().info?.weather).toEqual(weather);
  await act(() => oldResponse.resolve({ ...response, data: {
    weather: { ...weather, temperature: 10 }, airQuality,
  } }));
  expect(useEnvironmentStore.getState().info?.weather.temperature).toBe(24);
  await hook.unmount();
  expect(request.mock.calls[1]?.[1]?.signal?.aborted).toBe(true);
  await act(async () => { await jest.advanceTimersByTimeAsync(120_000); });
  expect(request).toHaveBeenCalledTimes(2);
});

it('waits for a location before requesting weather', async () => {
  useUserLocationStore.setState({ position: null });
  const hook = await renderHook(() => useEnvironment());
  expect(request).not.toHaveBeenCalled();
  request.mockResolvedValueOnce(response);
  await act(() => useUserLocationStore.getState().setPosition({ lat: 25.0478, lng: 121.5170 }));
  expect(useEnvironmentStore.getState().info?.weather).toEqual(weather);
  await hook.unmount();
});
