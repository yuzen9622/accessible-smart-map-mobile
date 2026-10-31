import type { CameraRef } from '@maplibre/maplibre-react-native';
import { act, renderHook } from '@testing-library/react-native';

import { registerMapCamera } from '@/features/map/controller/mapCamera';
import { sheetNavigation } from '@/features/map/controller/sheetNavigation';
import { useMapUiStore } from '@/features/map/store/mapUiStore';
import { useUserLocationStore } from '@/features/map/store/userLocationStore';
import type { AccessibleRoute } from '@/features/route/domain';
import { useRouteSessionStore } from '@/features/route/store/routeSessionStore';
import { fitSelectedRoute } from '@/features/route/controller/routeSessionPort';

import { beginNavigation, endNavigation } from '../../controller/navigationSession';
import { NAV_PITCH } from '../../domain/navCamera';
import { useNavStore } from '../../store/navStore';
import { useNavigationEffects } from '../useNavigationEffects';

jest.mock('@/features/map', () => ({
  ...jest.requireActual('@/features/map/controller/mapCamera'),
  ...jest.requireActual('@/features/map/store/mapUiStore'),
  ...jest.requireActual('@/features/map/store/userLocationStore'),
  ...jest.requireActual('@/features/map/domain/facilities'),
  ...jest.requireActual('@/features/map/controller/sheetNavigation'),
}));
jest.mock('@/features/route', () => ({
  ...jest.requireActual('@/features/route/hooks/useRouteSession'),
  ...jest.requireActual('@/features/route/controller/routeSessionPort'),
}));
jest.mock('@/features/bus', () => ({
  ...jest.requireActual('@/features/bus/store/busStore'),
}));
jest.mock('../useNavigationSession', () => ({ useNavigationSession: () => {} }));
jest.mock('../../controller/expoSpeechPort', () => ({ expoSpeechPort: {} }));
jest.mock('../../controller/liveNavigationDriver', () => ({ startLiveNavigationDriver: () => () => {} }));
jest.mock('../../liveActivity/liveActivityPort', () => ({ createLiveNavigationPort: () => ({}) }));
jest.mock('@/shared/haptics', () => ({ haptic: { commit: jest.fn(), emphasis: jest.fn(), success: jest.fn(), warning: jest.fn() } }));
jest.mock('expo-router', () => ({ router: { navigate: jest.fn(), dismiss: jest.fn(), dismissTo: jest.fn() } }));
jest.mock('@/shared/location', () => ({ startBackgroundLocation: async () => {}, stopBackgroundLocation: async () => {} }));
jest.mock('@/shared/accessibility', () => ({ isReduceMotionEnabled: () => false, motionDuration: (ms: number) => ms }));
jest.mock('@/shared/i18n', () => ({ useAppTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('expo-keep-awake', () => ({ activateKeepAwakeAsync: jest.fn(), deactivateKeepAwake: jest.fn() }));

const route: AccessibleRoute = {
  routeId: 'walk',
  routeToken: 'walk-token',
  routeName: '步行',
  totalMinutes: 3,
  transferCount: 0,
  accessibilityHighlights: [],
  legs: [{
    type: 'WALK', from: 'A', to: 'B', distanceM: 200, minutesEst: 3, a11yFacilities: [],
    polyline: [[121.5, 25.03], [121.502, 25.03]],
  }],
};

const camera = {
  setStop: jest.fn<ReturnType<CameraRef['setStop']>, Parameters<CameraRef['setStop']>>().mockResolvedValue(undefined),
  flyTo: jest.fn(),
  easeTo: jest.fn(),
  jumpTo: jest.fn(),
  fitBounds: jest.fn(),
  zoomTo: jest.fn(),
} satisfies CameraRef;

beforeEach(() => {
  jest.clearAllMocks();
  useNavStore.getState().reset();
  useNavStore.setState({ isNavigating: true });
  useRouteSessionStore.setState({ navigationRoute: { index: 0, route } });
  useMapUiStore.setState({ follow: null, followInterrupted: false });
  useUserLocationStore.setState({ position: { lat: 25.03, lng: 121.5 } });
  registerMapCamera(camera);
});

afterEach(() => registerMapCamera(null));

async function interruptFollow() {
  // MapScreen receives native onTrackUserLocationChange(null) after a pan.
  await act(() => {
    useMapUiStore.getState().setFollow(null);
    useMapUiStore.getState().setFollowInterrupted(true);
  });
}

it('changes pitch after repeated pans without resuming follow or recentering', async () => {
  await renderHook(useNavigationEffects);
  expect(useMapUiStore.getState().follow).not.toBeNull();

  for (let pan = 0; pan < 3; pan += 1) {
    await interruptFollow();
    expect(useNavStore.getState().followPaused).toBe(true);
    camera.setStop.mockClear();
    camera.flyTo.mockClear();

    await act(() => useNavStore.getState().setViewMode('2d'));
    expect(camera.setStop).toHaveBeenLastCalledWith({ pitch: 0, duration: 600, easing: 'ease' });
    await act(() => useNavStore.getState().setViewMode('3d'));
    expect(camera.setStop).toHaveBeenLastCalledWith({ pitch: NAV_PITCH, duration: 600, easing: 'ease' });
    expect(camera.setStop).toHaveBeenCalledTimes(2);
    expect(camera.flyTo).not.toHaveBeenCalled();
    expect(useMapUiStore.getState().follow).toBeNull();
    expect(useNavStore.getState().followPaused).toBe(true);

    await act(() => useNavStore.getState().setFollowPaused(false));
    expect(useMapUiStore.getState().follow?.pitch).toBe(NAV_PITCH);
  }
});

it('changes pitch in route preview before GPS is near the route', async () => {
  useUserLocationStore.setState({ position: null });
  await renderHook(useNavigationEffects);
  camera.setStop.mockClear();
  camera.flyTo.mockClear();

  await act(() => useNavStore.getState().setViewMode('2d'));
  expect(camera.setStop).toHaveBeenLastCalledWith({ pitch: 0, duration: 600, easing: 'ease' });
  expect(camera.flyTo).not.toHaveBeenCalled();
  expect(useMapUiStore.getState().follow).toBeNull();
});

it('leaves the camera to native tracking while following', async () => {
  await renderHook(useNavigationEffects);
  expect(useMapUiStore.getState().follow).not.toBeNull();

  await act(() => useNavStore.getState().setViewMode('2d'));
  await act(() => useNavStore.getState().setViewMode('3d'));
  expect(useMapUiStore.getState().follow?.pitch).toBe(NAV_PITCH);
  for (const command of Object.values(camera)) expect(command).not.toHaveBeenCalled();
});

it.each([
  { is3d: false, pauseFollow: false },
  { is3d: false, pauseFollow: true },
  { is3d: true, pauseFollow: false },
  { is3d: true, pauseFollow: true },
])('returns to the complete route preview after ending navigation (%j)', async ({ is3d, pauseFollow }) => {
  useNavStore.setState({ isNavigating: false });
  useRouteSessionStore.setState({
    computeRoutes: [route], selectRoute: { index: 0, route }, navigationRoute: null,
  });
  useMapUiStore.setState({
    is3d, sheetInset: 300,
    bounds: [121.4998, 25.0298, 121.5002, 25.0302],
  });
  sheetNavigation.setVisible(true);
  await renderHook(useNavigationEffects);

  await act(() => fitSelectedRoute());
  expect(camera.fitBounds).toHaveBeenCalledTimes(1);
  const preview = camera.fitBounds.mock.calls[0];
  camera.fitBounds.mockClear();

  await act(() => beginNavigation({ notificationTitle: 'title', notificationBody: 'body' }));
  expect(useMapUiStore.getState().follow).not.toBeNull();
  if (pauseFollow) await interruptFollow();
  camera.setStop.mockClear();
  camera.flyTo.mockClear();

  await act(() => endNavigation());
  expect(useMapUiStore.getState().follow).toBeNull();
  expect(camera.fitBounds).toHaveBeenCalledTimes(1);
  expect(camera.fitBounds).toHaveBeenLastCalledWith(preview[0], {
    ...preview[1], pitch: is3d ? NAV_PITCH : 0, bearing: 0,
  });
  expect(camera.setStop).not.toHaveBeenCalled();

  await act(() => useUserLocationStore.setState({ position: { lat: 25.03, lng: 121.501 } }));
  expect(camera.flyTo).not.toHaveBeenCalled();
  expect(useMapUiStore.getState().follow).toBeNull();
});
