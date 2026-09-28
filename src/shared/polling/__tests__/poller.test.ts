import { createPoller, type PollContext, type VisibilitySource } from '../poller';
import { flushPromises } from '@/shared/testing/flushPromises';

function fakeVisibility(initial = true) {
  let active = initial;
  const listeners = new Set<(active: boolean) => void>();
  const source: VisibilitySource = {
    isActive: () => active,
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
  return {
    source,
    set(next: boolean) {
      active = next;
      listeners.forEach((fn) => fn(next));
    },
    listenerCount: () => listeners.size,
  };
}

async function flush(): Promise<void> {
  await flushPromises();
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe('createPoller', () => {
  it('runs immediately, then once per interval measured after each run', async () => {
    const calls: PollContext[] = [];
    const vis = fakeVisibility();
    const poller = createPoller({ intervalMs: 1000, visibility: vis.source, task: async (ctx) => void calls.push(ctx) });

    poller.start();
    await flush();
    expect(calls.map((c) => c.first)).toEqual([true]);

    jest.advanceTimersByTime(999);
    await flush();
    expect(calls).toHaveLength(1);
    jest.advanceTimersByTime(1);
    await flush();
    expect(calls.map((c) => c.first)).toEqual([true, false]);
    poller.stop();
  });

  it('does not call the task while backgrounded and refreshes immediately on return', async () => {
    const task = jest.fn(async () => {});
    const vis = fakeVisibility();
    const poller = createPoller({ intervalMs: 1000, visibility: vis.source, task });
    poller.start();
    await flush();
    expect(task).toHaveBeenCalledTimes(1);

    vis.set(false);
    jest.advanceTimersByTime(5000);
    await flush();
    expect(task).toHaveBeenCalledTimes(1);

    vis.set(true);
    await flush();
    expect(task).toHaveBeenCalledTimes(2);
    poller.stop();
  });

  it('never doubles the rate when a foreground event lands mid-cycle', async () => {
    const task = jest.fn(async () => {});
    const vis = fakeVisibility();
    const poller = createPoller({ intervalMs: 1000, visibility: vis.source, task });
    poller.start();
    await flush();
    vis.set(true); // 重複的前景事件
    await flush();
    expect(task).toHaveBeenCalledTimes(2);
    jest.advanceTimersByTime(1000);
    await flush();
    expect(task).toHaveBeenCalledTimes(3);
    expect(jest.getTimerCount()).toBe(1);
    poller.stop();
  });

  it('keeps polling after a failing run', async () => {
    const task = jest.fn(async () => {
      throw new Error('network');
    });
    const poller = createPoller({ intervalMs: 1000, visibility: fakeVisibility().source, task });
    poller.start();
    await flush();
    jest.advanceTimersByTime(1000);
    await flush();
    expect(task).toHaveBeenCalledTimes(2);
    poller.stop();
  });

  it('stop aborts the in-flight run, clears timers and unsubscribes', async () => {
    let seen: AbortSignal | null = null;
    const vis = fakeVisibility();
    const poller = createPoller({
      intervalMs: 1000,
      visibility: vis.source,
      task: ({ signal }) => {
        seen = signal;
        return new Promise(() => {});
      },
    });
    poller.start();
    await flush();
    poller.stop();
    expect(seen).not.toBeNull();
    expect((seen as unknown as AbortSignal).aborted).toBe(true);
    expect(jest.getTimerCount()).toBe(0);
    expect(vis.listenerCount()).toBe(0);
  });
});
