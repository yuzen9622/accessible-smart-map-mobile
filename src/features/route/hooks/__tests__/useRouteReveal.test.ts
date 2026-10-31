import { act, renderHook } from '@testing-library/react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { useRouteReveal } from '../useRouteReveal';

jest.mock('react-native-reanimated', () => ({ useReducedMotion: jest.fn(() => false) }));

beforeEach(() => {
  jest.useFakeTimers();
  jest.mocked(useReducedMotion).mockReturnValue(false);
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

function controlAnimationFrames() {
  let time = 0;
  let nextId = 0;
  const frames = new Map<number, FrameRequestCallback>();
  jest.spyOn(Date, 'now').mockImplementation(() => time);
  jest.spyOn(performance, 'now').mockImplementation(() => time);
  jest.spyOn(global, 'requestAnimationFrame').mockImplementation((callback) => {
    const id = ++nextId;
    frames.set(id, callback);
    return id;
  });
  jest.spyOn(global, 'cancelAnimationFrame').mockImplementation((id) => {
    if (typeof id === 'number') frames.delete(id);
  });
  return {
    async wait(milliseconds: number) {
      await act(() => {
        time += milliseconds;
        jest.advanceTimersByTime(milliseconds);
      });
    },
    async frame(timestamp: number) {
      await act(() => {
        time = timestamp;
        const callbacks = [...frames.values()];
        frames.clear();
        callbacks.forEach((callback) => callback(timestamp));
      });
    },
    pending: () => frames.size,
  };
}

it.each([60, 120])('advances on every display frame at %iHz after the framing delay', async (refreshRate) => {
  const clock = controlAnimationFrames();
  const { result } = await renderHook(() => useRouteReveal('route-1'));
  await clock.wait(799);
  expect(result.current).toBe(0);
  expect(clock.pending()).toBe(0);
  await clock.wait(1);
  await clock.frame(800);
  let previous = result.current;
  for (let frame = 1; frame <= 6; frame++) {
    await clock.frame(800 + frame * 1000 / refreshRate);
    expect(result.current).toBeGreaterThan(previous);
    previous = result.current;
  }
});

it('eases toward the destination and finishes after 1800ms without scheduling more frames', async () => {
  const clock = controlAnimationFrames();
  const { result } = await renderHook(() => useRouteReveal('route-1'));
  await clock.wait(800);
  await clock.frame(800);
  await clock.frame(1700);
  expect(result.current).toBeGreaterThan(0.5);
  expect(result.current).toBeLessThan(1);
  await clock.frame(2599);
  expect(result.current).toBeLessThan(1);
  await clock.frame(2600);
  expect(result.current).toBe(1);
  expect(clock.pending()).toBe(0);
});

it('cancels drawing when the route is removed and animates the next planning session', async () => {
  const clock = controlAnimationFrames();
  const { result, rerender } = await renderHook<number, { routeKey: string | null }>(
    ({ routeKey }) => useRouteReveal(routeKey),
    { initialProps: { routeKey: 'route-1' } },
  );
  await clock.wait(800);
  await clock.frame(800);
  await clock.frame(900);
  expect(result.current).toBeGreaterThan(0);
  await rerender({ routeKey: null });
  expect(result.current).toBe(1);
  expect(clock.pending()).toBe(0);
  await rerender({ routeKey: 'route-2' });
  expect(result.current).toBe(0);
});

it('keeps a newly selected route complete when replacing one during drawing', async () => {
  const clock = controlAnimationFrames();
  const { result, rerender } = await renderHook<number, { routeKey: string }>(
    ({ routeKey }) => useRouteReveal(routeKey),
    { initialProps: { routeKey: 'route-1' } },
  );
  await clock.wait(800);
  await clock.frame(800);
  await clock.frame(900);
  await rerender({ routeKey: 'route-2' });
  expect(result.current).toBe(1);
  expect(clock.pending()).toBe(0);
  await clock.wait(3000);
  expect(result.current).toBe(1);
  expect(clock.pending()).toBe(0);
});

it.each(['waiting', 'drawing'])('cancels the reveal on unmount while %s', async (phase) => {
  const clock = controlAnimationFrames();
  const { unmount } = await renderHook(() => useRouteReveal('route-1'));
  if (phase === 'drawing') {
    await clock.wait(800);
    await clock.frame(800);
    expect(clock.pending()).toBe(1);
  }
  await unmount();
  await clock.wait(3000);
  expect(clock.pending()).toBe(0);
});

it('waits for map framing and draws slowly enough to remain visible after the former 600ms duration', async () => {
  const clock = controlAnimationFrames();
  const { result } = await renderHook(() => useRouteReveal('route-1'));
  expect(result.current).toBe(0);
  await clock.wait(600);
  expect(result.current).toBe(0);
  await clock.wait(200);
  await clock.frame(800);
  await clock.frame(1600);
  expect(result.current).toBeGreaterThan(0);
  expect(result.current).toBeLessThan(1);
  await clock.frame(2600);
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
