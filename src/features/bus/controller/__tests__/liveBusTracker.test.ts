// 移植自 Web `src/hook/__tests__/useLiveBusPositions.test.ts`（commit 5eadc71），案例逐一保留。
// 差異：本 repo 的 transit API 改用物件參數並多帶 signal，呼叫參數的斷言隨之調整。
import type { BusLeg } from '@/features/route';

import { __clearRouteDetailCache } from '../../api/busRouteDetailCache';
import { fetchLeg } from '../liveBusTracker';

const mockGetBusArrival = jest.fn();
const mockGetLiveBusPositions = jest.fn();
const mockGetBusRouteDetail = jest.fn();

jest.mock('../../api/transit', () => ({
  getBusArrival: (...args: unknown[]) => mockGetBusArrival(...args),
  getLiveBusPositions: (...args: unknown[]) => mockGetLiveBusPositions(...args),
  getBusRouteDetail: (...args: unknown[]) => mockGetBusRouteDetail(...args),
}));

const stop = (seq: number, name: string) => ({
  seq,
  name,
  lat: 24.13,
  lng: 120.64,
  estimateMinutes: null,
  statusLabel: '正常',
});

/**
 * Route 99 as TDX actually publishes it: the ride 豐樂公園 → 國立臺中科技大學
 * exists only in direction 1, while the leg declares direction 0.
 */
const routeDetail = {
  ok: true,
  data: {
    directions: [
      {
        direction: 0,
        stops: [
          stop(0, '國立臺中科技大學'),
          stop(1, '美榮藥局'),
          stop(2, '豐樂公園'),
        ],
      },
      {
        direction: 1,
        stops: [
          stop(0, '豐樂公園'),
          stop(1, '美榮藥局'),
          stop(2, '國立臺中科技大學'),
        ],
      },
    ],
  },
};

const leg = {
  type: 'BUS',
  routeName: '99',
  direction: 0,
  departureStop: '豐樂公園',
  arrivalStop: '國立臺中科技大學',
  tdxCity: 'Taichung',
  nearestBus: { plateNumb: 'EAL-0386' },
} as unknown as BusLeg;

const vehicle = (plateNumb: string, subRouteUid?: string) => ({
  plateNumb,
  subRouteUid,
  lat: 24.13,
  lng: 120.64,
  speed: 20,
  gpsTime: '2026-09-05T17:00:00+08:00',
  isLowFloor: '是',
  hasLiftOrRamp: '是',
  vehicleClass: '大型巴士',
});

const arrivals = (
  items: {
    plateNumb?: string;
    estimateMinutes: number | null;
    direction?: 0 | 1;
    subRouteUid?: string;
  }[],
) => ({
  ok: true,
  data: {
    arrivals: items.map((i) => ({
      stopName: '豐樂公園',
      direction: 1,
      directionLabel: '返程',
      ...i,
    })),
  },
});

const positions = (
  plates: (string | { plate: string; subRouteUid?: string })[],
) => ({
  ok: true,
  data: {
    buses: plates.map((p) =>
      typeof p === 'string' ? vehicle(p) : vehicle(p.plate, p.subRouteUid),
    ),
  },
});

beforeEach(() => {
  __clearRouteDetailCache();
  mockGetBusArrival.mockReset();
  mockGetLiveBusPositions.mockReset();
  mockGetBusRouteDetail.mockReset();
  mockGetBusRouteDetail.mockResolvedValue(routeDetail);
});

const signal = new AbortController().signal;

describe('fetchLeg', () => {
  it("pins the vehicle the boarding stop's arrival feed names", async () => {
    mockGetBusArrival.mockResolvedValue(
      arrivals([{ plateNumb: 'KKA-1234', estimateMinutes: 4 }]),
    );
    mockGetLiveBusPositions.mockResolvedValue(positions(['KKA-1234', 'EAL-0386']));

    const [bus] = await fetchLeg(leg, signal);

    expect(bus.plateNumb).toBe('KKA-1234');
    expect(bus.isTarget).toBe(true);
  });

  // Regression: `nearestBus` is a snapshot from when the route was planned, so
  // pinning it tracked whichever vehicle was running the line *now* — marking
  // every stop it had served as 已過站 on a trip that had not departed yet.
  it('does not fall back to the plate the planner pinned', async () => {
    mockGetBusArrival.mockResolvedValue(
      arrivals([{ estimateMinutes: 17 }]), // dispatched, but no plate yet
    );
    mockGetLiveBusPositions.mockResolvedValue(positions(['EAL-0386']));

    expect(await fetchLeg(leg, signal)).toEqual([]);
  });

  // Regression: the ETA used to be attached unconditionally, so a plate from
  // the planner sat next to a countdown belonging to a different vehicle —
  // "已過站" and "約 17 分" describing the same marker.
  it('only reports an ETA that belongs to the pinned vehicle', async () => {
    mockGetBusArrival.mockResolvedValue(
      arrivals([
        { plateNumb: 'KKA-1234', estimateMinutes: 6 },
        { plateNumb: 'EAL-0386', estimateMinutes: 21 },
      ]),
    );
    mockGetLiveBusPositions.mockResolvedValue(positions(['KKA-1234', 'EAL-0386']));

    const [bus] = await fetchLeg(leg, signal);

    expect(bus.plateNumb).toBe('KKA-1234');
    expect(bus.estimateTime).toBe(6);
    expect(bus.etaStopName).toBe('豐樂公園');
  });

  it('pins nothing when the named vehicle is not in the live feed', async () => {
    mockGetBusArrival.mockResolvedValue(
      arrivals([{ plateNumb: 'KKA-1234', estimateMinutes: 4 }]),
    );
    mockGetLiveBusPositions.mockResolvedValue(positions(['EAL-0386']));

    expect(await fetchLeg(leg, signal)).toEqual([]);
  });

  it('pins nothing when no vehicle is running the line', async () => {
    mockGetBusArrival.mockResolvedValue(
      arrivals([{ plateNumb: 'KKA-1234', estimateMinutes: 4 }]),
    );
    mockGetLiveBusPositions.mockResolvedValue({ ok: true, data: { buses: [] } });

    expect(await fetchLeg(leg, signal)).toEqual([]);
  });

  it('ignores arrivals for the other direction', async () => {
    mockGetBusArrival.mockResolvedValue(
      arrivals([{ plateNumb: 'KKA-1234', estimateMinutes: 2, direction: 0 }]),
    );
    mockGetLiveBusPositions.mockResolvedValue(positions(['KKA-1234']));

    expect(await fetchLeg(leg, signal)).toEqual([]);
  });

  // Regression: the leg declares direction 0 but the ride only exists in
  // direction 1. Asking TDX about direction 0 pinned a vehicle running the
  // opposite way and showed its arrival time for a journey the user was not
  // taking — the "已過站" stop list next to a "約 17 分" marker.
  it('queries the direction that actually contains the ride', async () => {
    mockGetBusArrival.mockResolvedValue(
      arrivals([{ plateNumb: 'KKA-1234', estimateMinutes: 4 }]),
    );
    mockGetLiveBusPositions.mockResolvedValue(positions(['KKA-1234']));

    await fetchLeg(leg, signal);

    expect(mockGetBusArrival).toHaveBeenCalledWith(
      { routeName: '99', stopName: '豐樂公園', direction: 1, city: 'Taichung' },
      signal,
    );
    expect(mockGetLiveBusPositions).toHaveBeenCalledWith(
      { routeName: '99', city: 'Taichung', direction: 1 },
      signal,
    );
  });

  it('falls back to the declared direction when route-detail is unusable', async () => {
    mockGetBusRouteDetail.mockResolvedValue({ ok: false });
    mockGetBusArrival.mockResolvedValue(
      arrivals([{ plateNumb: 'KKA-1234', estimateMinutes: 4, direction: 0 }]),
    );
    mockGetLiveBusPositions.mockResolvedValue(positions(['KKA-1234']));

    const [bus] = await fetchLeg(leg, signal);

    expect(mockGetBusArrival).toHaveBeenCalledWith(
      { routeName: '99', stopName: '豐樂公園', direction: 0, city: 'Taichung' },
      signal,
    );
    expect(bus.plateNumb).toBe('KKA-1234');
  });

  it('survives an arrival lookup that throws', async () => {
    mockGetBusArrival.mockRejectedValue(new Error('network down'));
    mockGetLiveBusPositions.mockResolvedValue(positions(['KKA-1234']));

    expect(await fetchLeg(leg, signal)).toEqual([]);
  });
});

describe('fetchLeg sub-route scoping', () => {
  const legOn延 = {
    ...leg,
    subRouteUid: 'TXG991',
    subRouteName: '99延',
  } as BusLeg;

  it('asks TDX for the sub-route the planner booked', async () => {
    mockGetBusArrival.mockResolvedValue(
      arrivals([
        { plateNumb: 'KKA-1234', estimateMinutes: 4, subRouteUid: 'TXG991' },
      ]),
    );
    mockGetLiveBusPositions.mockResolvedValue(
      positions([{ plate: 'KKA-1234', subRouteUid: 'TXG991' }]),
    );

    await fetchLeg(legOn延, signal);

    expect(mockGetBusRouteDetail).toHaveBeenCalledWith('99延', 'Taichung');
    expect(mockGetBusArrival.mock.calls[0][0].routeName).toBe('99延');
    expect(mockGetLiveBusPositions.mock.calls[0][0].routeName).toBe('99延');
  });

  // Regression: 99 and 99延 share a feed. Pinning a 99延 vehicle for a 99 rider
  // tracked a bus that never reaches their stop.
  it('ignores vehicles running a different sub-route', async () => {
    mockGetBusArrival.mockResolvedValue(
      arrivals([
        { plateNumb: 'KKA-1234', estimateMinutes: 4, subRouteUid: 'TXG99' },
      ]),
    );
    mockGetLiveBusPositions.mockResolvedValue(
      positions([{ plate: 'KKA-1234', subRouteUid: 'TXG99' }]),
    );

    expect(await fetchLeg(legOn延, signal)).toEqual([]);
  });

  it('keeps records that carry no sub-route of their own', async () => {
    mockGetBusArrival.mockResolvedValue(
      arrivals([{ plateNumb: 'KKA-1234', estimateMinutes: 4 }]),
    );
    mockGetLiveBusPositions.mockResolvedValue(positions(['KKA-1234']));

    const [bus] = await fetchLeg(legOn延, signal);
    expect(bus.plateNumb).toBe('KKA-1234');
  });
});
