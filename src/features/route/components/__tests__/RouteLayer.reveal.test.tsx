import type { GeoJSONSourceProps } from '@maplibre/maplibre-react-native';
import { Layer } from '@maplibre/maplibre-react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import type { FeatureCollection } from 'geojson';
import * as ReactNative from 'react-native';

import { routePlanFixture } from '@/features/ai/domain/testing/routePlanFixture';

import * as routeLayerData from '../../domain/routeLayerData';
import * as routeReveal from '../../domain/routeReveal';
import { useRouteReveal } from '../../hooks/useRouteReveal';
import { useRouteSessionStore } from '../../store/routeSessionStore';
import type { AccessibleRoute, LngLatTuple, TravelMode } from '../../types/route';
import { ROUTE_ALTERNATIVE } from '@/shared/theme';
import RouteLayer from '../RouteLayer';

const mockSources = new Map<string, GeoJSONSourceProps>();

jest.mock('@maplibre/maplibre-react-native', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const Noop = () => null;
  return {
    Map: Noop, Camera: Noop, Layer: jest.fn(Noop), NativeUserLocation: Noop,
    GeoJSONSource: React.memo(function MockGeoJSONSource(props: GeoJSONSourceProps) {
      mockSources.set(props.id ?? '', props);
      return React.createElement('GeoJSONSource', { ...props, testID: props.id }, React.Children.map(props.children, (child) =>
        React.isValidElement<{ source?: string }>(child) ? React.cloneElement(child, { source: props.id }) : child));
    }),
  };
});
jest.mock('../../hooks/useRouteReveal', () => ({ useRouteReveal: jest.fn(() => 0) }));

function sourceData(id: string): FeatureCollection {
  const data = mockSources.get(id)?.data;
  if (!data || typeof data === 'string' || data.type !== 'FeatureCollection') {
    throw new Error(`Missing GeoJSON collection for ${id}`);
  }
  return data;
}

function selectBusRoute() {
  const route = routePlanFixture().routes[0];
  useRouteSessionStore.setState({ selectRoute: { index: 0, route } });
  return route;
}

beforeEach(() => {
  mockSources.clear();
  jest.mocked(Layer).mockClear();
  jest.mocked(useRouteReveal).mockReturnValue(0);
  useRouteSessionStore.setState(useRouteSessionStore.getInitialState());
});

afterEach(() => { jest.restoreAllMocks(); });

function selectCandidates(travelMode: TravelMode = 'drive') {
  const routes: AccessibleRoute[] = ['a', 'b'].map((routeId) => ({
    routeId, routeName: routeId, totalMinutes: 10, transferCount: 0, accessibilityHighlights: [],
    legs: [{ type: 'DRIVE', from: 'A', to: 'B', distanceM: 1000, durationMin: 10, polyline: [[120, 24], [120.1, 24.1]] }],
  }));
  useRouteSessionStore.setState({ computeRoutes: routes, selectRoute: { route: routes[0], index: 0 }, travelMode });
  return routes;
}

it('switches the shared selection on a candidate tap and makes the previous selection the candidate', async () => {
  const routes = selectCandidates();
  const view = await render(<RouteLayer />);
  expect([...mockSources.keys()]).toEqual(['route-alternatives', 'route-lines', 'route-points']);
  const stopPropagation = jest.fn();
  await fireEvent(view.getByTestId('route-alternatives'), 'press', {
    stopPropagation, nativeEvent: { features: sourceData('route-alternatives').features },
  });
  expect(stopPropagation).toHaveBeenCalled();
  expect(useRouteSessionStore.getState().selectRoute).toEqual({ route: routes[1], index: 1 });
  expect(useRouteSessionStore.getState().selectedRouteId).toBe('b');
  expect(sourceData('route-alternatives').features[0].properties).toEqual({ routeId: 'a' });
});

it('does not switch an overlapping selected line or accept a stale candidate hit', async () => {
  const routes = selectCandidates();
  const view = await render(<RouteLayer />);
  await fireEvent(view.getByTestId('route-lines'), 'press', { stopPropagation: jest.fn() });
  await fireEvent(view.getByTestId('route-alternatives'), 'press', {
    stopPropagation: jest.fn(), nativeEvent: { features: [{ properties: { routeId: 'removed' } }] },
  });
  expect(useRouteSessionStore.getState().selectRoute?.route).toBe(routes[0]);
});

it.each(['light', 'dark'] as const)('uses the %s candidate palette', async (theme) => {
  jest.spyOn(ReactNative, 'useColorScheme').mockReturnValue(theme);
  selectCandidates();
  await render(<RouteLayer />);
  const paints = jest.mocked(Layer).mock.calls.map(([props]) => props);
  expect(paints.find((props) => props.id === 'route-alternative-line')?.paint).toMatchObject({ 'line-color': ROUTE_ALTERNATIVE[theme].line });
  expect(paints.find((props) => props.id === 'route-alternative-casing')?.paint).toMatchObject({ 'line-color': ROUTE_ALTERNATIVE[theme].casing });
  expect(paints.filter((props) => props.id?.startsWith('route-alternative-'))).toEqual([
    expect.objectContaining({ source: 'route-alternatives', beforeId: 'route-line-casing' }),
    expect.objectContaining({ source: 'route-alternatives', beforeId: 'route-line-casing' }),
  ]);
});

it('does not rebuild candidates or their layers on each selected-route animation frame', async () => {
  selectCandidates();
  const build = jest.spyOn(routeLayerData, 'buildAlternativeRouteLines');
  const view = await render(<RouteLayer />);
  const data = sourceData('route-alternatives');
  const candidateLayerCalls = () => jest.mocked(Layer).mock.calls.filter(([props]) => 'source' in props && props.source === 'route-alternatives').length;
  const initialLayers = candidateLayerCalls();
  for (const progress of [0.2, 0.5, 1]) {
    jest.mocked(useRouteReveal).mockReturnValue(progress);
    await view.rerender(<RouteLayer />);
    expect(sourceData('route-alternatives')).toBe(data);
    expect(candidateLayerCalls()).toBe(initialLayers);
  }
  expect(build).toHaveBeenCalledTimes(1);
});

it('hides candidates in transit and when navigation disables alternatives', async () => {
  selectCandidates('transit');
  const view = await render(<RouteLayer />);
  expect(view.queryByTestId('route-alternatives')).toBeNull();
  await act(async () => { useRouteSessionStore.setState({ travelMode: 'drive' }); });
  expect(view.queryByTestId('route-alternatives')).not.toBeNull();
  await view.rerender(<RouteLayer showAlternatives={false} />);
  expect(view.queryByTestId('route-alternatives')).toBeNull();
});

it('reuses route geometry and the distance index while successive frames extend the visible line', async () => {
  selectBusRoute();
  const build = jest.spyOn(routeLayerData, 'buildRouteLayerData');
  const prepare = jest.spyOn(routeReveal, 'createRouteReveal');
  const view = await render(<RouteLayer />);
  expect(sourceData('route-lines').features).toEqual([]);

  jest.mocked(useRouteReveal).mockReturnValue(0.2);
  await view.rerender(<RouteLayer />);
  const earlyLine = sourceData('route-lines');
  jest.mocked(useRouteReveal).mockReturnValue(0.5);
  await view.rerender(<RouteLayer />);
  const laterLine = sourceData('route-lines');

  expect(earlyLine).toMatchObject({ features: [{ geometry: { coordinates: [[120, 24], [expect.closeTo(120.02, 6), expect.closeTo(24.02, 6)]] } }] });
  expect(laterLine).toMatchObject({ features: [{ geometry: { coordinates: [[120, 24], [expect.closeTo(120.05, 6), expect.closeTo(24.05, 6)]] } }] });
  expect(build).toHaveBeenCalledTimes(1);
  expect(prepare).toHaveBeenCalledTimes(1);
});

it('forwards the source to every memoized line layer without rerendering the styles per frame', async () => {
  selectBusRoute();
  const view = await render(<RouteLayer />);
  const layers = jest.mocked(Layer);
  const lineSources = layers.mock.calls.flatMap(([props]) => props.type === 'line' ? [props.source] : []);
  expect(lineSources).toEqual(Array(5).fill('route-lines'));
  const initialCalls = layers.mock.calls.length;

  for (const progress of [0.2, 0.5]) {
    jest.mocked(useRouteReveal).mockReturnValue(progress);
    await view.rerender(<RouteLayer />);
    expect(layers).toHaveBeenCalledTimes(initialCalls);
  }
});

it('keeps the points source stable during drawing and exposes the destination when drawing finishes', async () => {
  selectBusRoute();
  const view = await render(<RouteLayer />);
  const drawingPoints = sourceData('route-points');
  expect(drawingPoints.features.map((feature) => feature.properties?.kind)).toEqual(['origin']);

  for (const progress of [0.2, 0.5]) {
    jest.mocked(useRouteReveal).mockReturnValue(progress);
    await view.rerender(<RouteLayer />);
    expect(sourceData('route-points')).toBe(drawingPoints);
  }

  jest.mocked(useRouteReveal).mockReturnValue(1);
  await view.rerender(<RouteLayer />);
  const finishedPoints = sourceData('route-points');
  expect(finishedPoints).not.toBe(drawingPoints);
  expect(finishedPoints.features.map((feature) => feature.properties?.kind)).toEqual(['origin', 'destination']);
  await view.rerender(<RouteLayer />);
  expect(sourceData('route-points')).toBe(finishedPoints);
});

it('keeps one destination pin when the route has not been planned and the layer rerenders', async () => {
  jest.mocked(useRouteReveal).mockReturnValue(1);
  useRouteSessionStore.setState({ destination: { lat: 24.1, lng: 120.1 } });
  const view = await render(<RouteLayer />);
  const points = sourceData('route-points');

  await view.rerender(<RouteLayer />);
  await view.rerender(<RouteLayer />);

  expect(sourceData('route-points')).toBe(points);
  expect(points.features).toHaveLength(1);
  expect(points.features[0]).toMatchObject({
    geometry: { type: 'Point', coordinates: [120.1, 24.1] },
    properties: { id: 'destination', kind: 'destination' },
  });
});

it('reuses a bus geometry preview between frames and rebuilds only when that preview changes', async () => {
  const route = selectBusRoute();
  const preview: LngLatTuple[] = [[120, 24], [120.2, 24.2]];
  useRouteSessionStore.setState({ legGeometryPreview: { routeId: route.routeId, legIndex: 0, polyline: preview } });
  const build = jest.spyOn(routeLayerData, 'buildRouteLayerData');
  const prepare = jest.spyOn(routeReveal, 'createRouteReveal');
  const view = await render(<RouteLayer />);

  for (const progress of [0.2, 0.5, 1]) {
    jest.mocked(useRouteReveal).mockReturnValue(progress);
    await view.rerender(<RouteLayer />);
  }
  expect(build).toHaveBeenCalledTimes(1);
  expect(prepare).toHaveBeenCalledTimes(1);
  expect(sourceData('route-lines')).toMatchObject({ features: [{ geometry: { coordinates: preview } }] });

  const replacement: LngLatTuple[] = [[120, 24], [120.3, 24.3]];
  await act(async () => {
    useRouteSessionStore.setState({ legGeometryPreview: { routeId: route.routeId, legIndex: 0, polyline: replacement } });
  });
  expect(build).toHaveBeenCalledTimes(2);
  expect(prepare).toHaveBeenCalledTimes(2);
  expect(sourceData('route-lines')).toMatchObject({ features: [{ geometry: { coordinates: replacement } }] });
  expect(useRouteSessionStore.getState().selectRoute?.route).toBe(route);
  expect(route.legs[0].polyline).toEqual([[120, 24], [120.1, 24.1]]);
});
