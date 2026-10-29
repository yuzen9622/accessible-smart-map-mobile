import type { CameraRef } from '@maplibre/maplibre-react-native';
import { act, render } from '@testing-library/react-native';

import { registerMapCamera } from '@/features/map/controller/mapCamera';
import { useMapUiStore } from '@/features/map/store/mapUiStore';
import { usePreferencesStore } from '@/shared/preferences/preferencesStore';

import { createVenueDetail, createVenueRoute } from '../../domain/fixtures/venueFixture';
import { useIndoorStore } from '../../store/indoorStore';
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

it.each([false, true])('opens the building with one bounds-and-orientation movement in 3D=%s', async (is3d) => {
  useMapUiStore.setState({ is3d, sheetInset: 300, follow: { mode: 'heading', zoom: 18, pitch: 60 } });
  await render(<IndoorMapLayer />);

  expect(camera.fitBounds).toHaveBeenCalledTimes(1);
  expect(camera.fitBounds).toHaveBeenCalledWith([121, 25, 121.001, 25.001], {
    pitch: is3d ? 48 : 0, bearing: 0, duration: 800,
    padding: { top: 140, bottom: 300, left: 24, right: 76 },
  });
  expect(camera.setStop).not.toHaveBeenCalled();
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
