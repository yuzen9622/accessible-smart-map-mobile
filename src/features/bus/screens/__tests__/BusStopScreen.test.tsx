import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { flushPromises } from '@/shared/testing/flushPromises';

import BusStopScreen from '../BusStopScreen';

const mockNavigate = jest.fn();
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual<typeof import('react')>('react');
  return {
    Stack: { Screen: () => null },
    useRouter: () => ({ navigate: mockNavigate }),
    useLocalSearchParams: () => ({ stopName: '站牌', city: 'Taipei', lat: '25.04', lng: '121.5', routes: '["R"]' }),
    useIsFocused: () => true,
    useFocusEffect: (effect: () => void | (() => void)) => {
      useEffect(effect, [effect]);
    },
  };
});
jest.mock('@/features/map', () => ({
  mapCamera: { fitBounds: jest.fn(), flyTo: jest.fn() },
  useUserLocationStore: (selector: (s: { position: null }) => null) => selector({ position: null }),
}));
jest.mock('@/shared/i18n', () => ({
  useAppTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => (params ? `${key}:${Object.values(params).join(',')}` : key),
  }),
}));
jest.mock('@/shared/polling', () => {
  const actual = jest.requireActual('@/shared/polling/poller');
  return {
    createPoller: actual.createPoller,
    appStateVisibility: { isActive: () => true, subscribe: () => () => {} },
  };
});
const mockGetStopArrivals = jest.fn();
jest.mock('../../api/transit', () => ({
  getStopArrivals: (...args: unknown[]) => mockGetStopArrivals(...args),
}));

const row = (direction: number, extra: object = {}) => ({
  routeName: 'R',
  subRouteUid: `U${direction}`,
  subRouteName: `R${direction}`,
  direction,
  headsign: '不該出現的終點',
  estimateMinutes: 3,
  statusLabel: '',
  isLowFloor: true,
  hasLiftOrRamp: null,
  ...extra,
});

describe('BusStopScreen direction labels and navigation', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockGetStopArrivals.mockReset().mockResolvedValue({
      ok: true,
      data: { stopName: '站牌', city: 'Taipei', arrivals: [row(0, { headsign: '北端' }), row(2), row(10), row(255)] },
    });
  });

  it('only 0 and 1 get 往終點; 2, 10 and 255 never show the headsign', async () => {
    await render(<BusStopScreen />);
    await act(flushPromises);
    await fireEvent.press(screen.getByText(/nativeBusFilterAll/));
    expect(screen.queryByText(/不該出現的終點/)).toBeNull();
    expect(screen.getAllByText(/nativeBusHeadingTo:北端/).length).toBeGreaterThan(0);
    expect(screen.getAllByText('nativeBusDirectionSubRoute:R2,nativeBusDirectionLoop').length).toBeGreaterThan(0);
    expect(screen.getAllByText('nativeBusDirectionSubRoute:R10,nativeBusDirectionCircular').length).toBeGreaterThan(0);
    expect(screen.getAllByText('nativeBusDirectionSubRoute:R255,nativeBusDirectionUnknown').length).toBeGreaterThan(0);
  });

  it('opening a route keeps the sub-route and the exact direction', async () => {
    await render(<BusStopScreen />);
    await act(flushPromises);
    await fireEvent.press(screen.getByText(/nativeBusFilterAll/));
    await fireEvent.press(screen.getByText('nativeBusDirectionSubRoute:R10,nativeBusDirectionCircular'));
    expect(mockNavigate).toHaveBeenCalledWith({
      pathname: '/bus/route',
      params: expect.objectContaining({ routeName: 'R', direction: '10', subRouteUid: 'U10', stopName: '站牌' }),
    });
  });
});
