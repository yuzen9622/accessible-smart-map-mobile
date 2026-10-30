import type { CameraRef } from '@maplibre/maplibre-react-native';
import { act, render } from '@testing-library/react-native';

import { registerMapCamera } from '@/features/map/controller/mapCamera';
import { useMapUiStore } from '@/features/map/store/mapUiStore';
import { usePreferencesStore } from '@/shared/preferences/preferencesStore';

import { createVenueDetail, createVenueRoute } from '../../domain/fixtures/venueFixture';
import { useIndoorStore } from '../../store/indoorStore';
import type { VenueRoute } from '../../types/venue';
import IndoorMapLayer from '../IndoorMapLayer';

jest.mock('@maplibre/maplibre-react-native', () => {
  const Noop = () => null;
  return { Map: Noop, Camera: Noop, GeoJSONSource: Noop, Layer: Noop, Marker: Noop, NativeUserLocation: Noop };
});

const camera = {
  jumpTo: jest.fn(), easeTo: jest.fn(), flyTo: jest.fn(), fitBounds: jest.fn(),
  zoomTo: jest.fn(), setStop: jest.fn<Promise<void>, Parameters<CameraRef['setStop']>>().mockResolvedValue(undefined),
} satisfies CameraRef;

function seedVenue() {
  const detail = createVenueDetail();
  detail.buildings.push({
    ...detail.buildings[0], id: 'b', name: '另一測試館',
    footprint: [[[121.01, 25], [121.011, 25], [121.011, 25.001], [121.01, 25]]],
  });
  useIndoorStore.setState({
    active: true, selectedVenueId: detail.venueId, venue: { status: 'ready', data: detail },
    floor: { buildingId: 'a', levelRef: '1F' },
  });
}

function seedCampusJourney() {
  const detail = createVenueDetail();
  detail.buildings[0].levels[0].ordinal = 0;
  detail.buildings.push({
    ...detail.buildings[0], id: 'b', name: '另一測試館',
    footprint: [[[121.01, 25], [121.011, 25], [121.011, 25.001], [121.01, 25]]],
  });
  detail.places[1] = { ...detail.places[1], buildingId: 'b', levelRef: '1F', location: [121.0105, 25.0005] };
  // The published-style outdoor path bends outside both buildings' bounds.
  // A building-only camera, or a shortcut between room centers, misses it.
  const route: VenueRoute = { ...createVenueRoute(), elevatorRides: 0, path: {
    coordinates: [[121, 25, 0], [121.001, 25, 0], [121.004, 25.004, 0], [121.005, 24.999, 0], [121.01, 25, 0], [121.0105, 25.0005, 0]],
    buildingIds: ['a', 'a', null, null, 'b', 'b'], levelRefs: ['1F', '1F', null, null, '1F', '1F'],
  }, segments: [
    { buildingId: 'a', levelRef: '1F', pathStart: 0, pathEnd: 1 },
    { buildingId: null, levelRef: null, pathStart: 1, pathEnd: 4 },
    { buildingId: 'b', levelRef: '1F', pathStart: 4, pathEnd: 5 },
  ], steps: [
    { type: 'depart', instruction: '從一樓出發', distanceM: 0, durationS: 0, buildingId: 'a', levelRef: '1F', pathStart: 0, pathEnd: 0 },
    { type: 'walk', instruction: '沿一樓走廊前進', distanceM: 10, durationS: 10, buildingId: 'a', levelRef: '1F', pathStart: 0, pathEnd: 1 },
    { type: 'exit', instruction: '離開建築', distanceM: 10, durationS: 10, buildingId: null, levelRef: null, pathStart: 1, pathEnd: 2 },
    { type: 'walk', instruction: '沿校園步道前進', distanceM: 10, durationS: 10, buildingId: null, levelRef: null, pathStart: 2, pathEnd: 3 },
    { type: 'enter', instruction: '進入另一測試館', distanceM: 10, durationS: 10, buildingId: 'b', levelRef: '1F', pathStart: 3, pathEnd: 4 },
    { type: 'walk', instruction: '沿一樓走廊至教室', distanceM: 10, durationS: 10, buildingId: 'b', levelRef: '1F', pathStart: 4, pathEnd: 5 },
    { type: 'arrive', instruction: '抵達教室附近走廊', distanceM: 0, durationS: 0, buildingId: 'b', levelRef: '1F', pathStart: 5, pathEnd: 5 },
  ] };
  useIndoorStore.setState({
    active: true, selectedVenueId: detail.venueId, venue: { status: 'ready', data: detail },
    floor: { buildingId: 'a', levelRef: '1F' }, selectedPlaceId: 'end', plan: { status: 'ready', data: route },
  });
  return route;
}

beforeEach(() => {
  jest.clearAllMocks();
  useIndoorStore.getState().exitVenue();
  useIndoorStore.setState(useIndoorStore.getInitialState());
  useMapUiStore.setState(useMapUiStore.getInitialState());
  usePreferencesStore.getState().resetPreferences();
  registerMapCamera(camera);
  seedVenue();
});

afterEach(() => {
  registerMapCamera(null);
});

it.each([false, true])('opens the building with the intended orientation and bounds in 3D=%s', async (is3d) => {
  useMapUiStore.setState({ is3d, sheetInset: 300, follow: { mode: 'heading', zoom: 18, pitch: 60 } });
  await render(<IndoorMapLayer />);

  expect(camera.fitBounds).toHaveBeenCalledTimes(1);
  expect(camera.fitBounds).toHaveBeenCalledWith([121, 25, 121.001, 25.001], {
    pitch: is3d ? 48 : 0, bearing: 0, duration: 800,
    padding: { top: 140, bottom: 300, left: 24, right: 76 },
  });
  expect(camera.setStop).toHaveBeenLastCalledWith({ pitch: is3d ? 48 : 0, bearing: 0, duration: 0 });
  expect(camera.flyTo).not.toHaveBeenCalled();
  expect(useMapUiStore.getState().follow).toBeNull();
});

it.each([
  { buildingId: 'b', levelRef: '1F' },
  { buildingId: 'a', levelRef: '3F' },
])('resumes the browsed floor without flying to a stale selection in $buildingId/$levelRef', async (floor) => {
  useIndoorStore.getState().selectPlace('start');
  useIndoorStore.getState().selectFloor(floor);
  useIndoorStore.getState().suspend();
  await render(<IndoorMapLayer />);
  jest.clearAllMocks();

  await act(async () => { useIndoorStore.getState().resume(); });

  expect(useIndoorStore.getState()).toMatchObject({ active: true, floor, selectedPlaceId: 'start' });
  expect(camera.fitBounds).toHaveBeenCalledTimes(1);
  expect(camera.flyTo).not.toHaveBeenCalled();
});

it('centers the confirmed route start when guidance begins, rather than the selected destination', async () => {
  useIndoorStore.getState().selectPlace('end');
  useIndoorStore.setState({ plan: { status: 'ready', data: createVenueRoute() } });
  await render(<IndoorMapLayer />);
  jest.clearAllMocks();

  await act(async () => { useIndoorStore.getState().startGuidance(); });

  expect(useIndoorStore.getState()).toMatchObject({
    floor: { buildingId: 'a', levelRef: '1F' },
    guidance: { status: 'guiding', stepIndex: 0, confirmed: { buildingId: 'a', levelRef: '1F' } },
  });
  expect(camera.flyTo).toHaveBeenCalledTimes(1);
  expect(camera.flyTo).toHaveBeenLastCalledWith(expect.objectContaining({ center: [121, 25], zoom: 20.2, pitch: 0 }));
});

it('keeps manual floor browsing separate from the guidance camera until the elevator step is confirmed', async () => {
  useIndoorStore.setState({ plan: { status: 'ready', data: createVenueRoute() } });
  useIndoorStore.getState().startGuidance();
  useIndoorStore.getState().confirmStep();
  useIndoorStore.getState().confirmStep();
  await render(<IndoorMapLayer />);
  jest.clearAllMocks();

  await act(async () => { useIndoorStore.getState().selectFloor({ buildingId: 'a', levelRef: '3F' }); });
  expect(camera.flyTo).not.toHaveBeenCalled();
  expect(camera.fitBounds).not.toHaveBeenCalled();
  await act(async () => { useIndoorStore.getState().selectFloor({ buildingId: 'b', levelRef: '1F' }); });
  expect(camera.flyTo).not.toHaveBeenCalled();
  expect(camera.fitBounds).toHaveBeenLastCalledWith([121.01, 25, 121.011, 25.001], expect.anything());
  expect(useIndoorStore.getState().guidance).toMatchObject({ status: 'guiding', stepIndex: 2, confirmed: { buildingId: 'a', levelRef: '1F' } });
  jest.clearAllMocks();

  await act(async () => { useIndoorStore.getState().confirmStep(); });

  expect(useIndoorStore.getState()).toMatchObject({
    floor: { buildingId: 'a', levelRef: '2F' },
    guidance: { status: 'guiding', stepIndex: 3, confirmed: { buildingId: 'a', levelRef: '2F' } },
  });
  expect(camera.flyTo).toHaveBeenCalledTimes(1);
  expect(camera.flyTo).toHaveBeenLastCalledWith(expect.objectContaining({ center: [121.0001, 25], zoom: 20.2 }));
});

it('does not return a browsed building to the route start when the map layer remounts', async () => {
  useIndoorStore.setState({ plan: { status: 'ready', data: createVenueRoute() } });
  useIndoorStore.getState().startGuidance();
  useIndoorStore.getState().selectFloor({ buildingId: 'b', levelRef: '1F' });

  await render(<IndoorMapLayer />);

  expect(camera.fitBounds).toHaveBeenLastCalledWith([121.01, 25, 121.011, 25.001], expect.anything());
  expect(camera.flyTo).not.toHaveBeenCalled();
  expect(useIndoorStore.getState().guidance).toMatchObject({ status: 'guiding', stepIndex: 0 });
});

it.each([false, true])('frames the complete ground-floor journey including outdoor turns and the other classroom in 3D=%s', async (is3d) => {
  seedCampusJourney();
  useMapUiStore.setState({ is3d, sheetInset: 300 });

  await render(<IndoorMapLayer />);

  expect(camera.fitBounds).toHaveBeenLastCalledWith([121, 24.999, 121.0105, 25.004], {
    pitch: is3d ? 48 : 0, bearing: 0, duration: 800,
    padding: { top: 180, bottom: 300, left: 24, right: 76 },
  });
  expect(camera.flyTo).not.toHaveBeenCalled();
  expect(useIndoorStore.getState().guidance.status).toBe('idle');
});

it('reframes the whole planned journey when switching from 2D to 3D', async () => {
  seedCampusJourney();
  await render(<IndoorMapLayer />);
  jest.clearAllMocks();

  await act(async () => { useMapUiStore.setState({ is3d: true }); });

  expect(camera.fitBounds).toHaveBeenLastCalledWith([121, 24.999, 121.0105, 25.004], expect.objectContaining({ pitch: 48 }));
  expect(camera.flyTo).not.toHaveBeenCalled();
  expect(useIndoorStore.getState().guidance.status).toBe('idle');
});

it('follows the authored outdoor step after leaving a building while retaining its ground-floor display', async () => {
  seedCampusJourney();
  useMapUiStore.setState({ is3d: true });
  await render(<IndoorMapLayer />);
  await act(async () => {
    useIndoorStore.getState().startGuidance();
    useIndoorStore.getState().confirmStep();
    useIndoorStore.getState().confirmStep();
  });
  jest.clearAllMocks();

  await act(async () => { useIndoorStore.getState().confirmStep(); });

  expect(useIndoorStore.getState()).toMatchObject({
    floor: { buildingId: 'a', levelRef: '1F' },
    guidance: { status: 'guiding', stepIndex: 3, confirmed: { buildingId: null, levelRef: null } },
  });
  expect(camera.flyTo).toHaveBeenCalledTimes(1);
  expect(camera.flyTo).toHaveBeenLastCalledWith(expect.objectContaining({ center: [121.004, 25.004], zoom: 20.2, pitch: 48 }));
  expect(camera.fitBounds).not.toHaveBeenCalled();
});
