import { ApiError, type ApiResponse } from '@/shared/api';

import type { AccessibleRoute, AccessibleRouteData, RoutePreviewPageData } from '../../types/route';
import { useRouteSessionStore } from '../../store/routeSessionStore';
import {
  applyComputedRoutes,
  computeRoute,
  endRouteSession,
  hasActiveRouteSession,
  loadRoutePreview,
  replaceSelectedRoute,
} from '../routeSessionPort';

const mockFitBounds = jest.fn();
const mockUserLocation: { position: { lat: number; lng: number } | null } = { position: null };

jest.mock('@/features/map', () => ({
  mapCamera: { fitBounds: (...args: unknown[]) => mockFitBounds(...args) },
  useUserLocationStore: { getState: () => mockUserLocation },
}));

const mockGetAccessibleRoute = jest.fn();
const mockGetLineRoutePreview = jest.fn();
jest.mock('../../api/route', () => ({
  getAccessibleRoute: (...args: unknown[]) => mockGetAccessibleRoute(...args),
  getLineRoutePreview: (...args: unknown[]) => mockGetLineRoutePreview(...args),
}));

const ORIGIN = { lat: 25.0478, lng: 121.517 };
const DEST = { lat: 25.0408, lng: 121.5654 };

function route(id: string): AccessibleRoute {
  return {
    routeId: id,
    routeName: id,
    totalMinutes: 20,
    transferCount: 0,
    accessibilityHighlights: [],
    legs: [
      {
        type: 'WALK',
        from: 'A',
        to: 'B',
        distanceM: 100,
        minutesEst: 2,
        a11yFacilities: [],
        polyline: [
          [121.517, 25.0478],
          [121.5654, 25.0408],
        ],
      },
    ],
  };
}

function ok(data: Partial<AccessibleRouteData>): ApiResponse<AccessibleRouteData> {
  return {
    ok: true,
    status: 'success',
    code: 200,
    message: 'ok',
    data: { origin: ORIGIN, destination: DEST, city: 'Taipei', routes: [], ...data },
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

beforeEach(() => {
  mockFitBounds.mockReset();
  mockGetAccessibleRoute.mockReset();
  mockGetLineRoutePreview.mockReset();
  mockUserLocation.position = null;
  useRouteSessionStore.getState().endRouteSession();
});

describe('computeRoute', () => {
  it('stores results, selects the first route and frames it', async () => {
    mockGetAccessibleRoute.mockResolvedValue(ok({ routes: [route('a'), route('b')], waypoints: [{ lat: 25.05, lng: 121.53 }] }));

    const result = await computeRoute({ origin: ORIGIN, destination: DEST, mode: 'wheelchair' });

    expect(result.ok).toBe(true);
    const s = useRouteSessionStore.getState();
    expect(s.computeRoutes?.map((r) => r.routeId)).toEqual(['a', 'b']);
    expect(s.selectRoute?.index).toBe(0);
    expect(s.routeWaypoints).toEqual([{ lat: 25.05, lng: 121.53 }]);
    expect(s.isLoading).toBe(false);
    expect(mockFitBounds).toHaveBeenCalledWith([121.517, 25.0408, 121.5654, 25.05], { top: 70, left: 40, right: 40 });
    expect(mockGetAccessibleRoute.mock.calls[0][0]).toEqual({
      origin: { latitude: 25.0478, longitude: 121.517 },
      destination: { latitude: 25.0408, longitude: 121.5654 },
      mode: 'wheelchair',
    });
  });

  it('keeps origin/destination but drops the stale result when nothing comes back', async () => {
    useRouteSessionStore.getState().setDestination(DEST, '市政府');
    useRouteSessionStore.setState({ selectRoute: { index: 0, route: route('old') } });
    mockGetAccessibleRoute.mockResolvedValue(ok({ routes: [] }));

    const result = await computeRoute({ origin: ORIGIN, destination: DEST });

    expect(result).toEqual({ ok: false, failure: 'empty' });
    const s = useRouteSessionStore.getState();
    expect(s.destination).toEqual(DEST);
    expect(s.destinationName).toBe('市政府');
    expect(s.selectRoute).toBeNull();
    expect(s.lastFailure).toBe('empty');
  });

  it('classifies 422 reasons from the backend', async () => {
    mockGetAccessibleRoute.mockRejectedValue(new ApiError('no', 422, 'NO_ACCESSIBLE_ROUTE'));
    expect(await computeRoute({ origin: ORIGIN, destination: DEST })).toEqual({
      ok: false,
      failure: 'no-accessible-route',
    });
    mockGetAccessibleRoute.mockRejectedValue(new TypeError('Network request failed'));
    expect(await computeRoute({ origin: ORIGIN, destination: DEST })).toEqual({ ok: false, failure: 'failed' });
  });

  it('rejects out-of-coverage trips without calling the backend', async () => {
    const result = await computeRoute({ origin: ORIGIN, destination: { lat: 35.68, lng: 139.77 } });
    expect(result).toEqual({ ok: false, failure: 'too-far' });
    expect(mockGetAccessibleRoute).not.toHaveBeenCalled();
    expect(useRouteSessionStore.getState().lastFailure).toBe('too-far');
  });

  it('uses the user location when only a destination is given', async () => {
    mockUserLocation.position = ORIGIN;
    mockGetAccessibleRoute.mockResolvedValue(ok({ routes: [route('a')] }));
    await computeRoute({ destination: DEST });
    expect(mockGetAccessibleRoute.mock.calls[0][0].origin).toEqual({ latitude: 25.0478, longitude: 121.517 });
  });

  it('drops a response that arrives after the session was ended', async () => {
    const pending = deferred<ApiResponse<AccessibleRouteData>>();
    mockGetAccessibleRoute.mockReturnValue(pending.promise);

    const running = computeRoute({ origin: ORIGIN, destination: DEST });
    expect(useRouteSessionStore.getState().isLoading).toBe(true);
    endRouteSession();
    const signal: AbortSignal = mockGetAccessibleRoute.mock.calls[0][1];
    expect(signal.aborted).toBe(true);

    pending.resolve(ok({ routes: [route('late')] }));
    expect(await running).toEqual({ ok: false, failure: 'superseded' });
    expect(hasActiveRouteSession()).toBe(false);
    expect(mockFitBounds).not.toHaveBeenCalled();
  });

  it('lets the newest request win when two overlap', async () => {
    const first = deferred<ApiResponse<AccessibleRouteData>>();
    mockGetAccessibleRoute.mockReturnValueOnce(first.promise).mockResolvedValueOnce(ok({ routes: [route('second')] }));

    const a = computeRoute({ origin: ORIGIN, destination: DEST });
    const b = computeRoute({ origin: ORIGIN, destination: DEST, travelMode: 'walk' });
    expect(await b).toMatchObject({ ok: true });
    first.resolve(ok({ routes: [route('first')] }));
    expect(await a).toEqual({ ok: false, failure: 'superseded' });
    expect(useRouteSessionStore.getState().selectRoute?.route.routeId).toBe('second');
  });
});

describe('endRouteSession', () => {
  it('clears everything that puts route geometry on the map, including origin and destination', async () => {
    mockGetAccessibleRoute.mockResolvedValue(ok({ routes: [route('a')], waypoints: [DEST] }));
    const store = useRouteSessionStore.getState();
    store.setOrigin(ORIGIN, '台北車站');
    store.setDestination(DEST, '市政府');
    await computeRoute({ origin: ORIGIN, destination: DEST });
    expect(hasActiveRouteSession()).toBe(true);

    endRouteSession();

    const s = useRouteSessionStore.getState();
    expect({
      origin: s.origin,
      originName: s.originName,
      destination: s.destination,
      destinationName: s.destinationName,
      computeRoutes: s.computeRoutes,
      selectRoute: s.selectRoute,
      routeWaypoints: s.routeWaypoints,
      metroAlerts: s.metroAlerts,
      transitAlerts: s.transitAlerts,
    }).toEqual({
      origin: null,
      originName: '',
      destination: null,
      destinationName: '',
      computeRoutes: null,
      selectRoute: null,
      routeWaypoints: [],
      metroAlerts: null,
      transitAlerts: null,
    });
    expect(hasActiveRouteSession()).toBe(false);
  });
});

describe('applyComputedRoutes / loadRoutePreview', () => {
  it('puts externally computed routes into the session', () => {
    applyComputedRoutes(ORIGIN, DEST, [route('sos')]);
    expect(useRouteSessionStore.getState().selectRoute?.route.routeId).toBe('sos');
    expect(mockFitBounds).toHaveBeenCalledTimes(1);
  });

  it('ignores an empty route list', () => {
    applyComputedRoutes(ORIGIN, DEST, []);
    expect(hasActiveRouteSession()).toBe(false);
  });

  it('hydrates a LINE route preview with its labels', async () => {
    const preview: RoutePreviewPageData = {
      sessionId: 's1',
      origin: { label: '我的位置', lat: ORIGIN.lat, lng: ORIGIN.lng },
      destination: { label: '市政府', lat: DEST.lat, lng: DEST.lng },
      routes: [{ routeName: '步行', totalMinutes: 30, legs: [{ type: 'WALK', durationMin: 30 }] }],
    };
    mockGetLineRoutePreview.mockResolvedValue({ ok: true, status: 'success', code: 200, message: 'ok', data: preview });

    expect(await loadRoutePreview('s1')).toBe(true);
    const s = useRouteSessionStore.getState();
    expect(s.destinationName).toBe('市政府');
    expect(s.originName).toBe('我的位置');
    expect(s.computeRoutes?.[0].routeId).toBe('line-preview-0');
    // 預覽 leg 沒有 polyline：相機以起訖點取景。
    expect(mockFitBounds.mock.calls[0][0]).toEqual([121.517, 25.0408, 121.5654, 25.0478]);
  });

  it('reports failure for an expired preview', async () => {
    mockGetLineRoutePreview.mockRejectedValue(new ApiError('gone', 404));
    expect(await loadRoutePreview('expired')).toBe(false);
    expect(hasActiveRouteSession()).toBe(false);
  });
});

describe('request generations (review follow-ups)', () => {
  function abortable() {
    return (_request: unknown, signal: AbortSignal) =>
      new Promise<never>((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
      });
  }

  it('treats a real AbortError after endRouteSession as superseded, not a failure', async () => {
    mockGetAccessibleRoute.mockImplementation(abortable());
    const running = computeRoute({ origin: ORIGIN, destination: DEST });
    endRouteSession();
    expect(await running).toEqual({ ok: false, failure: 'superseded' });
    const s = useRouteSessionStore.getState();
    expect(s.lastFailure).toBeNull();
    expect(s.isLoading).toBe(false);
  });

  it('a too-far request invalidates the one still running', async () => {
    const pending = deferred<ApiResponse<AccessibleRouteData>>();
    mockGetAccessibleRoute.mockReturnValue(pending.promise);
    const first = computeRoute({ origin: ORIGIN, destination: DEST });

    expect(await computeRoute({ origin: ORIGIN, destination: { lat: 35.68, lng: 139.77 } })).toEqual({
      ok: false,
      failure: 'too-far',
    });
    pending.resolve(ok({ routes: [route('stale')] }));
    expect(await first).toEqual({ ok: false, failure: 'superseded' });

    const s = useRouteSessionStore.getState();
    expect(s.computeRoutes).toBeNull();
    expect(s.isLoading).toBe(false);
    expect(s.lastFailure).toBe('too-far');
  });

  it('applyComputedRoutes wins over a computeRoute still in flight and resets its extras', async () => {
    mockGetAccessibleRoute.mockResolvedValueOnce(
      ok({ routes: [route('a')], waypoints: [DEST], transitAlerts: [] }),
    );
    await computeRoute({ origin: ORIGIN, destination: DEST });
    expect(useRouteSessionStore.getState().routeWaypoints).toHaveLength(1);

    const pending = deferred<ApiResponse<AccessibleRouteData>>();
    mockGetAccessibleRoute.mockReturnValueOnce(pending.promise);
    const running = computeRoute({ origin: ORIGIN, destination: DEST });
    applyComputedRoutes(ORIGIN, DEST, [route('sos')]);
    pending.resolve(ok({ routes: [route('late')] }));

    expect(await running).toEqual({ ok: false, failure: 'superseded' });
    const s = useRouteSessionStore.getState();
    expect(s.selectRoute?.route.routeId).toBe('sos');
    expect(s.routeWaypoints).toEqual([]);
    expect(s.transitAlerts).toBeNull();
  });

  function preview(label = '市政府'): ApiResponse<RoutePreviewPageData> {
    return {
      ok: true,
      status: 'success',
      code: 200,
      message: 'ok',
      data: {
        sessionId: 's1',
        origin: { label: '起點' },
        destination: { label, lat: DEST.lat, lng: DEST.lng },
        routes: [{ routeName: '步行', totalMinutes: 30, legs: [{ type: 'WALK' }] }],
      },
    };
  }

  it('a preview that finishes after the session was ended does not resurrect it', async () => {
    const pending = deferred<ApiResponse<RoutePreviewPageData>>();
    mockGetLineRoutePreview.mockReturnValue(pending.promise);
    const loading = loadRoutePreview('s1');
    endRouteSession();
    pending.resolve(preview());
    expect(await loading).toBe(false);
    expect(hasActiveRouteSession()).toBe(false);
  });

  it('a newer computeRoute beats a preview still loading', async () => {
    const pending = deferred<ApiResponse<RoutePreviewPageData>>();
    mockGetLineRoutePreview.mockReturnValue(pending.promise);
    mockGetAccessibleRoute.mockResolvedValue(ok({ routes: [route('mine')] }));

    const loading = loadRoutePreview('s1');
    await computeRoute({ origin: ORIGIN, destination: DEST });
    pending.resolve(preview());

    expect(await loading).toBe(false);
    const s = useRouteSessionStore.getState();
    expect(s.selectRoute?.route.routeId).toBe('mine');
    expect(s.destinationName).toBe('');
  });

  it('clears a stale origin when the preview has no origin coordinates', async () => {
    useRouteSessionStore.getState().setOrigin({ lat: 1, lng: 1 }, '舊起點');
    mockGetLineRoutePreview.mockResolvedValue(preview());
    expect(await loadRoutePreview('s1')).toBe(true);
    const s = useRouteSessionStore.getState();
    expect(s.origin).toBeNull();
    expect(s.originName).toBe('');
  });

  it('rejects a preview whose destination has no usable coordinates', async () => {
    const broken = preview();
    mockGetLineRoutePreview.mockResolvedValue({
      ...broken,
      data: broken.data && { ...broken.data, destination: JSON.parse('{"label":"x"}') },
    });
    expect(await loadRoutePreview('s1')).toBe(false);
    expect(hasActiveRouteSession()).toBe(false);
    expect(useRouteSessionStore.getState().isLoading).toBe(false);
  });

  it('leaves an existing route intact when a preview fails', async () => {
    mockGetAccessibleRoute.mockResolvedValue(ok({ routes: [route('mine')], waypoints: [DEST] }));
    useRouteSessionStore.getState().setDestination(DEST, '市政府');
    await computeRoute({ origin: ORIGIN, destination: DEST });
    mockGetLineRoutePreview.mockRejectedValue(new ApiError('gone', 404));

    expect(await loadRoutePreview('expired')).toBe(false);
    const s = useRouteSessionStore.getState();
    expect(s.computeRoutes?.map((r) => r.routeId)).toEqual(['mine']);
    expect(s.selectRoute?.route.routeId).toBe('mine');
    expect(s.routeWaypoints).toEqual([DEST]);
    expect(s.destinationName).toBe('市政府');
    expect(s.isLoading).toBe(false);
  });
});

describe('replaceSelectedRoute', () => {
  it('swaps the selected route and its slot in the result list', async () => {
    mockGetAccessibleRoute.mockResolvedValue(ok({ routes: [route('a'), route('b')] }));
    await computeRoute({ origin: ORIGIN, destination: DEST });
    useRouteSessionStore.getState().selectRouteIndex(1);

    expect(replaceSelectedRoute(route('b-v2'))).toBe(true);
    const s = useRouteSessionStore.getState();
    expect(s.selectRoute).toEqual({ index: 1, route: route('b-v2') });
    expect(s.computeRoutes?.map((r) => r.routeId)).toEqual(['a', 'b-v2']);
  });

  it('never resurrects an ended session', () => {
    expect(replaceSelectedRoute(route('late'))).toBe(false);
    expect(hasActiveRouteSession()).toBe(false);
  });
});
