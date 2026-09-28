// 移植自 Web `src/lib/navigation/__tests__/foregroundLocation.test.ts`（commit 5eadc71），案例逐一保留；
// 瀏覽器 Geolocation 的假物件改成 LocationPort 形狀的 `getCurrent`。
import { requestForegroundLocationFix, type ForegroundFix } from '../foregroundLocation';
import { flushPromises } from '@/shared/testing/flushPromises';

function fakeGetCurrent(overrides: Partial<ForegroundFix> = {}) {
  return jest.fn(async (): Promise<ForegroundFix> => ({ lat: 25.0478, lng: 121.517, heading: null, ...overrides }));
}

async function flush(): Promise<void> {
  await flushPromises();
}

describe('requestForegroundLocationFix', () => {
  it('asks for a fresh fix while in the foreground', () => {
    const getCurrent = fakeGetCurrent();
    const requested = requestForegroundLocationFix({ isVisible: () => true, getCurrent, onPosition: jest.fn() });
    expect(requested).toBe(true);
    expect(getCurrent).toHaveBeenCalledTimes(1);
  });

  it('does nothing while backgrounded', () => {
    const getCurrent = fakeGetCurrent();
    const requested = requestForegroundLocationFix({ isVisible: () => false, getCurrent, onPosition: jest.fn() });
    expect(requested).toBe(false);
    expect(getCurrent).not.toHaveBeenCalled();
  });

  it('does nothing when the platform exposes no location source', () => {
    expect(requestForegroundLocationFix({ isVisible: () => true, getCurrent: undefined, onPosition: jest.fn() })).toBe(
      false,
    );
  });

  it('publishes the fresh fix with its course-over-ground', async () => {
    const onPosition = jest.fn();
    requestForegroundLocationFix({ isVisible: () => true, getCurrent: fakeGetCurrent({ heading: 90 }), onPosition });
    await flush();
    expect(onPosition).toHaveBeenCalledWith({ lat: 25.0478, lng: 121.517 }, 90);
  });

  it('reports a missing or NaN heading as null', async () => {
    const onPosition = jest.fn();
    requestForegroundLocationFix({
      isVisible: () => true,
      getCurrent: fakeGetCurrent({ heading: Number.NaN }),
      onPosition,
    });
    await flush();
    expect(onPosition).toHaveBeenCalledWith({ lat: 25.0478, lng: 121.517 }, null);
  });

  it('swallows a failed fix', async () => {
    const onPosition = jest.fn();
    const getCurrent = jest.fn(async (): Promise<ForegroundFix> => {
      throw new Error('timeout');
    });
    expect(requestForegroundLocationFix({ isVisible: () => true, getCurrent, onPosition })).toBe(true);
    await flush();
    expect(onPosition).not.toHaveBeenCalled();
  });
});
