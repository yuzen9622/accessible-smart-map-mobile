import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { flushPromises } from '@/shared/testing/flushPromises';

import { useBusPanelStore } from '../../store/busPanelStore';
import BusRouteScreen from '../BusRouteScreen';

let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual<typeof import('react')>('react');
  return {
    Stack: { Screen: () => null },
    useLocalSearchParams: () => mockParams,
    useIsFocused: () => true,
    useFocusEffect: (effect: () => void | (() => void)) => {
      useEffect(effect, [effect]);
    },
  };
});
jest.mock('@/features/map', () => ({
  mapCamera: { fitBounds: jest.fn(), flyTo: jest.fn() },
  useMapUiStore: (selector: (s: { sheetInset: number }) => number) => selector({ sheetInset: 0 }),
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
jest.mock('@/features/notifications', () => ({ requestPushPermission: async () => 'granted' }));
const mockSchedule = jest.fn();
const mockCancel = jest.fn();
jest.mock('expo-notifications', () => ({
  scheduleNotificationAsync: (...args: unknown[]) => mockSchedule(...args),
  cancelScheduledNotificationAsync: (...args: unknown[]) => mockCancel(...args),
  SchedulableTriggerInputTypes: { TIME_INTERVAL: 'timeInterval' },
}));

const mockGetBusRouteDetail = jest.fn();
const mockGetLiveBusPositions = jest.fn();
const mockGetBusArrival = jest.fn();
jest.mock('../../api/transit', () => ({
  getBusRouteDetail: (...args: unknown[]) => mockGetBusRouteDetail(...args),
  getLiveBusPositions: (...args: unknown[]) => mockGetLiveBusPositions(...args),
  getBusArrival: (...args: unknown[]) => mockGetBusArrival(...args),
}));

// 每站相隔約 1 km（經度 0.01°）。
const stop = (seq: number, name: string, lng: number, estimateMinutes: number | null = null, statusLabel = '') => ({
  seq,
  name,
  lat: 25.04,
  lng,
  estimateMinutes,
  statusLabel,
});

const directions = [
  { direction: 0, subRouteUid: 'U1', subRouteName: '主線', stops: [stop(1, '甲站', 121.5), stop(2, '乙站', 121.51, 7), stop(3, '丙站', 121.52)] },
  { direction: 0, subRouteUid: 'U2', subRouteName: '支線', stops: [stop(1, '甲站', 121.5), stop(2, '丁站', 121.6), stop(3, '戊站', 121.61)] },
  { direction: 10, subRouteUid: 'U1', subRouteName: '主線', stops: [stop(1, '環甲', 121.5), stop(2, '環乙', 121.51, 4), stop(3, '環丙', 121.52)] },
  { direction: 255, subRouteUid: 'U1', subRouteName: '主線', stops: [stop(1, '未甲', 121.5), stop(2, '未乙', 121.51, 5)] },
];

const bus = (plateNumb: string, direction: number, lng: number, subRouteUid = 'U1') => ({
  plateNumb,
  direction,
  subRouteUid,
  lat: 25.04,
  lng,
  isLowFloor: '是',
  hasLiftOrRamp: '否',
});

beforeEach(() => {
  mockParams = { routeName: 'R', city: 'Taipei' };
  mockGetBusRouteDetail.mockReset().mockResolvedValue({ ok: true, data: { directions } });
  mockGetLiveBusPositions.mockReset().mockImplementation(async (query: { direction: number }) => ({
    ok: true,
    data: { buses: [bus('P-10', 10, 121.5), bus('P-0A', 0, 121.505), bus('P-0B', 0, 121.6, 'U2'), bus('P-255', 255, 121.51)].filter((b) => b.direction === query.direction) },
  }));
  mockGetBusArrival.mockReset().mockResolvedValue({ ok: true, data: { arrivals: [] } });
  mockSchedule.mockReset().mockResolvedValue('n1');
  mockCancel.mockReset().mockResolvedValue(undefined);
  useBusPanelStore.getState().clear();
});

async function renderScreen() {
  await render(<BusRouteScreen />);
  await act(flushPromises);
}

const radio = (name: string) => screen.getByRole('radio', { name });

describe('BusRouteScreen dynamic direction menu', () => {
  it('lists exactly the returned runs, with branch names for same-direction branches', async () => {
    await renderScreen();
    expect(screen.getAllByRole('radio').map((r) => r.props.accessibilityLabel)).toEqual([
      'nativeBusDirectionSubRoute:主線,nativeBusHeadingTo:丙站',
      'nativeBusDirectionSubRoute:支線,nativeBusHeadingTo:戊站',
      'nativeBusDirectionSubRoute:主線,nativeBusDirectionCircular',
      'nativeBusDirectionSubRoute:主線,nativeBusDirectionUnknown',
    ]);
    expect(radio('nativeBusDirectionSubRoute:主線,nativeBusHeadingTo:丙站').props.accessibilityState.selected).toBe(true);
  });

  it('keeps the two same-direction branches apart: stops and buses of the other branch never show', async () => {
    await renderScreen();
    expect(screen.queryByText('丁站')).toBeNull();
    expect(useBusPanelStore.getState().buses.map((b) => b.plateNumb)).toEqual(['P-0A']);

    await fireEvent.press(radio('nativeBusDirectionSubRoute:支線,nativeBusHeadingTo:戊站'));
    await act(flushPromises);
    expect(screen.getByText('丁站')).toBeTruthy();
    expect(screen.queryByText('乙站')).toBeNull();
    expect(useBusPanelStore.getState().buses.map((b) => b.plateNumb)).toEqual(['P-0B']);
    expect(useBusPanelStore.getState().displayedStops.map((s) => s.name)).toEqual(['甲站', '丁站', '戊站']);
  });

  it('direction 10 shows 循環線 and its own stops and bus, and queries direction 10', async () => {
    await renderScreen();
    await fireEvent.press(radio('nativeBusDirectionSubRoute:主線,nativeBusDirectionCircular'));
    await act(flushPromises);
    expect(screen.getByText('環乙')).toBeTruthy();
    expect(screen.getAllByRole('header')[0]?.props.children).toBe('nativeBusDirectionCircular');
    expect(mockGetLiveBusPositions.mock.calls.at(-1)?.[0]).toMatchObject({ direction: 10 });
    expect(useBusPanelStore.getState().buses.map((b) => b.plateNumb)).toEqual(['P-10']);
  });

  it('direction 255 shows the unknown-direction title and its data', async () => {
    await renderScreen();
    await fireEvent.press(radio('nativeBusDirectionSubRoute:主線,nativeBusDirectionUnknown'));
    await act(flushPromises);
    expect(screen.getAllByRole('header')[0]?.props.children).toBe('nativeBusDirectionUnknown');
    expect(screen.getByText('未乙')).toBeTruthy();
    expect(mockGetLiveBusPositions.mock.calls.at(-1)?.[0]).toMatchObject({ direction: 255 });
    expect(useBusPanelStore.getState().buses.map((b) => b.plateNumb)).toEqual(['P-255']);
  });

  it('a route with only directions 2 and 10 offers exactly those, with no phantom 0/1', async () => {
    mockGetBusRouteDetail.mockResolvedValue({
      ok: true,
      data: { directions: [{ direction: 2, stops: [stop(1, 'A', 121.5), stop(2, 'B', 121.51)] }, { direction: 10, stops: [stop(1, 'C', 121.5)] }] },
    });
    await renderScreen();
    expect(screen.getAllByRole('radio').map((r) => r.props.accessibilityLabel)).toEqual(['nativeBusDirectionLoop', 'nativeBusDirectionCircular']);
  });

  it('keeps the initially selected direction 10 when a refresh adds direction 0', async () => {
    jest.useFakeTimers();
    const circular = directions.filter((d) => d.direction === 10);
    mockGetBusRouteDetail.mockResolvedValueOnce({ ok: true, data: { directions: circular } });
    mockGetBusRouteDetail.mockResolvedValue({ ok: true, data: { directions: [directions[0], ...circular] } });
    try {
      await renderScreen();
      expect(radio('nativeBusDirectionCircular').props.accessibilityState.selected).toBe(true);
      await act(async () => {
        jest.advanceTimersByTime(30_000);
        await flushPromises();
      });
      expect(radio('nativeBusDirectionCircular').props.accessibilityState.selected).toBe(true);
    } finally {
      jest.useRealTimers();
    }
  });

  it('navigation params pick the sub-route and direction', async () => {
    mockParams = { routeName: 'R', city: 'Taipei', direction: '0', subRouteUid: 'U2' };
    await renderScreen();
    expect(screen.getByText('丁站')).toBeTruthy();
  });
});

describe('BusRouteScreen tracking and reminders', () => {
  const arrival = (over: object) => ({
    stopName: '環乙',
    direction: 10,
    directionLabel: '',
    estimateMinutes: 4,
    statusLabel: '',
    plateNumb: 'P-10',
    subRouteUid: 'U1',
    ...over,
  });

  beforeEach(() => {
    mockParams = { routeName: 'R', city: 'Taipei', stopName: '環乙', direction: '10', subRouteUid: 'U1' };
  });

  it('locks the chased bus to the plate of the arrival record and shows how far it is', async () => {
    mockGetBusArrival.mockResolvedValue({ ok: true, data: { arrivals: [arrival({}), arrival({ plateNumb: 'OTHER', estimateMinutes: 12 })] } });
    await renderScreen();
    expect(mockGetBusArrival.mock.calls[0][0]).toEqual({ routeName: 'R', stopName: '環乙', direction: 10, city: 'Taipei' });
    expect(screen.getByText(/環甲 · nativeBusStopsAway:1/, { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByText('nativeBusTrackTitleAccessible')).toBeTruthy();
  });

  it('without a determinable plate it shows the stop ETA and no bus position', async () => {
    mockGetBusArrival.mockResolvedValue({ ok: true, data: { arrivals: [arrival({ plateNumb: undefined })] } });
    await renderScreen();
    expect(screen.getByText('nativeBusTrackNoBus')).toBeTruthy();
    expect(screen.getByText('4')).toBeTruthy();
    expect(screen.queryByText(/nativeBusStopsAway/, { includeHiddenElements: true })).toBeNull();
    expect(screen.getByText('nativeBusTrackTitle')).toBeTruthy();
  });

  it('does not borrow the nearest bus for the stop ETA when the arrival names no plate', async () => {
    mockGetBusArrival.mockResolvedValue({ ok: true, data: { arrivals: [arrival({ plateNumb: undefined, subRouteUid: 'U2' })] } });
    await renderScreen();
    expect(screen.queryByText(/nativeBusStopsAway/, { includeHiddenElements: true })).toBeNull();
  });

  it('direction 255: no tracking card, no reminder, no alight, and no arrival query', async () => {
    mockParams = { routeName: 'R', city: 'Taipei', stopName: '未乙', direction: '255', subRouteUid: 'U1' };
    await renderScreen();
    expect(screen.getByText('nativeBusTrackUnknownDirection')).toBeTruthy();
    expect(screen.queryByText('nativeBusRemindMe')).toBeNull();
    expect(mockGetBusArrival).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByText('未甲'));
    expect(screen.queryByText('nativeBusSetAlight')).toBeNull();
  });

  it('starts a reminder, and switching the direction cancels it', async () => {
    mockGetBusArrival.mockResolvedValue({ ok: true, data: { arrivals: [arrival({})] } });
    await renderScreen();
    await fireEvent.press(screen.getByText('nativeBusRemindMe'));
    await act(flushPromises);
    expect(mockSchedule).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/nativeBusReminderOn/)).toBeTruthy();

    await fireEvent.press(radio('nativeBusDirectionSubRoute:主線,nativeBusHeadingTo:丙站'));
    await act(flushPromises);
    expect(mockCancel).toHaveBeenCalledWith('n1');
    expect(screen.queryByText(/nativeBusReminderOn/)).toBeNull();
  });

  it('an unavailable ETA disables the reminder', async () => {
    mockGetBusArrival.mockResolvedValue({ ok: true, data: { arrivals: [] } });
    mockGetBusRouteDetail.mockResolvedValue({
      ok: true,
      data: { directions: [{ direction: 10, subRouteUid: 'U1', stops: [stop(1, '環甲', 121.5), stop(2, '環乙', 121.51, null, '正常')] }] },
    });
    await renderScreen();
    expect(screen.getAllByText('busEtaUnknown').length).toBeGreaterThan(0);
    await fireEvent.press(screen.getByText('nativeBusRemindMe'));
    await act(flushPromises);
    expect(mockSchedule).not.toHaveBeenCalled();
  });
});
