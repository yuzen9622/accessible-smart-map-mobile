import { startSosLifecycle, type SosLifecycleStatus, type SosStreamHandlers } from '../sosLifecycle';
import type { SosSnapshot } from '../types';

function snap(id: string, status: 'active' | 'resolved' = 'active'): SosSnapshot {
  return {
    sessionId: id,
    status,
    handlingStatus: 'notified',
    claimedBy: null,
    claimedByName: null,
    claimedAt: null,
    acknowledgements: [],
    timeline: [],
    location: null,
    resolvedAt: null,
    updatedAt: '2026-09-29T00:00:00Z',
  };
}

async function flush() {
  for (let i = 0; i < 20; i++) await Promise.resolve();
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe('startSosLifecycle', () => {
  it('seeds with a snapshot, then streams updates and reports streaming', async () => {
    const snapshots: string[] = [];
    const statuses: SosLifecycleStatus[] = [];
    let handlers: SosStreamHandlers | null = null;
    const lifecycle = startSosLifecycle(
      {
        fetchSnapshot: async () => snap('seed'),
        openStream: (h) => {
          handlers = h;
          return new Promise(() => {});
        },
      },
      { onSnapshot: (s) => snapshots.push(s.sessionId), onStatus: (s) => statuses.push(s) },
    );
    await flush();
    expect(snapshots).toEqual(['seed']);
    handlers!.onOpen();
    handlers!.onSnapshot(snap('update-1'));
    expect(snapshots).toEqual(['seed', 'update-1']);
    expect(statuses).toEqual(['connecting', 'streaming']);
    lifecycle.stop();
  });

  it('retries the stream with 1s then 2s backoff and falls back to 8s polling after 3 consecutive failures', async () => {
    const statuses: SosLifecycleStatus[] = [];
    let openCalls = 0;
    const fetchSnapshot = jest.fn(async () => snap('poll'));
    const lifecycle = startSosLifecycle(
      {
        fetchSnapshot,
        openStream: async () => {
          openCalls += 1;
          throw new Error('SSE open failed: 401');
        },
      },
      { onSnapshot: () => {}, onStatus: (s) => statuses.push(s) },
    );
    await flush();
    expect(openCalls).toBe(1);
    jest.advanceTimersByTime(999);
    await flush();
    expect(openCalls).toBe(1);
    jest.advanceTimersByTime(1);
    await flush();
    expect(openCalls).toBe(2);
    jest.advanceTimersByTime(2000);
    await flush();
    expect(openCalls).toBe(3);
    expect(statuses).toContain('polling');
    const seedAndFirstPoll = fetchSnapshot.mock.calls.length;
    expect(seedAndFirstPoll).toBe(2);
    jest.advanceTimersByTime(8000);
    await flush();
    expect(fetchSnapshot).toHaveBeenCalledTimes(3);
    lifecycle.stop();
    jest.advanceTimersByTime(16000);
    await flush();
    expect(fetchSnapshot).toHaveBeenCalledTimes(3);
  });

  it('resets the retry counter after a successful open (only consecutive failures count)', async () => {
    let openCalls = 0;
    const statuses: SosLifecycleStatus[] = [];
    const lifecycle = startSosLifecycle(
      {
        fetchSnapshot: async () => null,
        openStream: async (h) => {
          openCalls += 1;
          // 奇數次成功打開後被伺服器關閉，偶數次連線失敗
          if (openCalls % 2 === 1) h.onOpen();
          else throw new Error('network');
        },
      },
      { onSnapshot: () => {}, onStatus: (s) => statuses.push(s) },
    );
    for (let i = 0; i < 6; i++) {
      await flush();
      jest.advanceTimersByTime(5000);
    }
    await flush();
    expect(openCalls).toBeGreaterThan(3);
    expect(statuses).not.toContain('polling');
    lifecycle.stop();
  });

  it('native-only: a server-closed stream reconnects instead of silently freezing', async () => {
    let openCalls = 0;
    const lifecycle = startSosLifecycle(
      {
        fetchSnapshot: async () => null,
        openStream: async (h) => {
          openCalls += 1;
          h.onOpen();
        },
      },
      { onSnapshot: () => {}, onStatus: () => {} },
    );
    await flush();
    jest.advanceTimersByTime(1000);
    await flush();
    expect(openCalls).toBe(2);
    lifecycle.stop();
  });

  it('marks error when polling fails but keeps polling', async () => {
    const statuses: SosLifecycleStatus[] = [];
    let calls = 0;
    const lifecycle = startSosLifecycle(
      {
        fetchSnapshot: async () => {
          calls += 1;
          if (calls >= 2) throw new Error('offline');
          return null;
        },
        openStream: async () => {
          throw new Error('x');
        },
        maxStreamRetries: 1,
      },
      { onSnapshot: () => {}, onStatus: (s) => statuses.push(s) },
    );
    await flush();
    expect(statuses).toEqual(['connecting', 'polling', 'error']);
    jest.advanceTimersByTime(8000);
    await flush();
    expect(calls).toBe(3);
    lifecycle.stop();
  });

  it('stop() during the seed request prevents any callback', async () => {
    const onSnapshot = jest.fn();
    let resolveSeed: (s: SosSnapshot) => void = () => {};
    const openStream = jest.fn(async () => {});
    const lifecycle = startSosLifecycle(
      {
        fetchSnapshot: () =>
          new Promise<SosSnapshot>((resolve) => {
            resolveSeed = resolve;
          }),
        openStream,
      },
      { onSnapshot, onStatus: () => {} },
    );
    lifecycle.stop();
    resolveSeed(snap('late'));
    await flush();
    expect(onSnapshot).not.toHaveBeenCalled();
    expect(openStream).not.toHaveBeenCalled();
  });
});
