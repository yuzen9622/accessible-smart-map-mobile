import { act, renderHook } from '@testing-library/react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { useRouteReveal } from '../useRouteReveal';

jest.mock('react-native-reanimated', () => ({ useReducedMotion: jest.fn(() => false) }));

beforeEach(() => {
  jest.useFakeTimers();
  jest.mocked(useReducedMotion).mockReturnValue(false);
});

afterEach(() => { jest.useRealTimers(); });

it('waits for map framing and draws slowly enough to remain visible after the former 600ms duration', async () => {
  const { result } = await renderHook(() => useRouteReveal('route-1'));
  expect(result.current).toBe(0);
  await act(async () => { jest.advanceTimersByTime(600); });
  expect(result.current).toBe(0);
  await act(async () => { jest.advanceTimersByTime(1000); });
  expect(result.current).toBeGreaterThan(0);
  expect(result.current).toBeLessThan(1);
  await act(async () => { jest.advanceTimersByTime(1400); });
  expect(result.current).toBe(1);
});

it('shows the complete route immediately with reduced motion', async () => {
  jest.mocked(useReducedMotion).mockReturnValue(true);
  const { result } = await renderHook(() => useRouteReveal('route-1'));
  expect(result.current).toBe(1);
  await act(async () => { jest.advanceTimersByTime(3000); });
  expect(result.current).toBe(1);
});

it('cancels the pending reveal when selecting another route', async () => {
  const { result, rerender, unmount } = await renderHook<number, { routeKey: string }>(({ routeKey }) => useRouteReveal(routeKey), { initialProps: { routeKey: 'route-1' } });
  await rerender({ routeKey: 'route-2' });
  expect(result.current).toBe(1);
  await act(async () => { jest.advanceTimersByTime(1600); });
  expect(result.current).toBe(1);
  await unmount();
});
