import { render, screen } from '@testing-library/react-native';
import { recordRouteNameLanguage, type AccessibleRoute, type BusLeg } from '@/features/route/domain';
import { busLegKey, useBusStore } from '../../store/busStore';
import type { RouteDetailDirection } from '../../types/transit';
import BusLegStops from '../BusLegStops';

let mockLanguage: 'en' | 'zh-TW' = 'en';
let mockDirections: RouteDetailDirection[] | null = null;
jest.mock('@/shared/i18n', () => ({
  getAppLanguage: () => mockLanguage,
  useAppTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('../../hooks/useBusLegStopEtas', () => ({
  useBusLegStopEtas: () => ({ directions: mockDirections, status: mockDirections ? 'ready' : 'error' }),
}));

function fixture(): { route: AccessibleRoute; leg: BusLeg } {
  const names = ['起站', '中間站', '終站'];
  const stops = names.map((name, i) => ({ name, stopUid: `S${i}`, lat: 25, lng: 121.5 + i * 0.01, departureAt: 1000 }));
  const leg: BusLeg = {
    type: 'BUS', routeName: '紅一', routeDisplayName: 'Red 1', routeNameEn: 'Red 1',
    departureStop: names[0], arrivalStop: names[2], departureStopId: 'S0', arrivalStopId: 'S2',
    fromDisplayName: 'Origin', toDisplayName: 'Destination', fromNameEn: 'Origin', toNameEn: 'Destination',
    intermediateStops: [{ name: names[1], stationUid: 'S1', nameEn: 'Middle', displayName: 'Middle' }],
    direction: 0, estimatedWaitMinutes: 0, waitInfo: { time: null, source: 'unavailable' },
    polyline: [], departureStopA11y: [], arrivalStopA11y: [],
    scheduledTrip: { tripId: 'trip', boardingReadyAt: 1000, stops },
  };
  const route: AccessibleRoute = {
    routeId: 'route', routeToken: 'token', routeName: '方案', totalMinutes: 10,
    transferCount: 0, accessibilityHighlights: [], legs: [leg],
  };
  recordRouteNameLanguage(route, 'en');
  return { route, leg };
}

beforeEach(() => { mockLanguage = 'en'; mockDirections = null; useBusStore.setState({ activeBusLeg: null, liveBusPositions: [] }); });

it.each(['success', 'failure'] as const)('presents planned stop names for %s without changing canonical matching', async (status) => {
  const { route, leg } = fixture();
  if (status === 'success') {
    mockDirections = [{ direction: 0, stops: leg.scheduledTrip!.stops.map((stop, index) => ({
      ...stop, lat: stop.lat!, lng: stop.lng!, seq: index + 1, estimateMinutes: null, statusLabel: '',
    })) }];
  }
  useBusStore.setState({ activeBusLeg: { key: busLegKey(route, 0, 0, leg), route, leg } });
  const before = JSON.stringify(route);
  const view = await render(<BusLegStops route={route} routeIndex={0} legIndex={0} leg={leg} />);
  expect(screen.getByText('Middle')).toBeTruthy();
  expect(screen.getByText('Origin')).toBeTruthy();
  expect(screen.getByText('Destination')).toBeTruthy();
  mockLanguage = 'zh-TW';
  await view.rerender(<BusLegStops route={route} routeIndex={0} legIndex={0} leg={leg} />);
  expect(screen.getByText('中間站')).toBeTruthy();
  expect(screen.queryByText('Middle')).toBeNull();
  expect(JSON.stringify(route)).toBe(before);
  expect(useBusStore.getState().activeBusLeg?.leg).toBe(leg);
});
