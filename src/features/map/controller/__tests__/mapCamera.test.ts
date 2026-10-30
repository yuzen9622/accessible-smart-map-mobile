import type { CameraRef, LngLat, LngLatBounds } from '@maplibre/maplibre-react-native';

import type * as Controller from '../mapCamera';
import type { useMapUiStore as MapStore } from '../../store/mapUiStore';

let mockReduceMotion = false;
jest.mock('@/shared/accessibility', () => ({
  isReduceMotionEnabled: () => mockReduceMotion,
  motionDuration: (duration: number) => mockReduceMotion ? 0 : duration,
}));
jest.mock('@/shared/logger', () => ({ logger: { warn: jest.fn() } }));

const taipeiBounds: LngLatBounds = [121.5, 25, 121.6, 25.1];
const nearby: LngLat = [121.55, 25.05];
const campus: LngLat = [120.684, 24.15];
const campusBounds: LngLatBounds = [120.68, 24.14, 120.69, 24.16];
const padding = { top: 0, bottom: 300, left: 0, right: 0 };

function createCamera() {
  return {
    jumpTo: jest.fn(), easeTo: jest.fn(), flyTo: jest.fn(), fitBounds: jest.fn(), zoomTo: jest.fn(),
    setStop: jest.fn<Promise<void>, Parameters<CameraRef['setStop']>>().mockResolvedValue(undefined),
  } satisfies CameraRef;
}

function deferred() {
  let resolve!: () => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

const settleCommands = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
let controller: typeof Controller;
let store: typeof MapStore;
let warn: jest.Mock;
let native: ReturnType<typeof createCamera>;

beforeEach(() => {
  mockReduceMotion = false;
  jest.isolateModules(() => {
    controller = jest.requireActual('../mapCamera');
    store = jest.requireActual('../../store/mapUiStore').useMapUiStore;
    warn = jest.requireMock('@/shared/logger').logger.warn;
  });
  warn.mockClear();
  native = createCamera();
  store.setState({ ...store.getInitialState(), bounds: taipeiBounds, sheetInset: 300 });
  controller.registerMapCamera(native);
});

it('reaches a distant classroom from a tilted viewport only after the flat native stop is accepted', async () => {
  const accepted = deferred();
  native.setStop.mockReturnValueOnce(accepted.promise);
  store.setState({ is3d: true });

  controller.mapCamera.flyTo(campus, 20.2, 48);

  expect(native.setStop).toHaveBeenCalledWith({ pitch: 0, duration: 0 });
  expect(native.flyTo).not.toHaveBeenCalled();
  accepted.resolve();
  await settleCommands();
  expect(native.flyTo).toHaveBeenCalledTimes(1);
  expect(native.flyTo).toHaveBeenCalledWith({ center: campus, zoom: 20.2, pitch: 48, padding });
});

it.each(['flyTo', 'easeTo'] as const)('keeps nearby %s synchronous and animated', (method) => {
  store.setState({ is3d: true });
  controller.mapCamera[method](nearby, 18);
  expect(native.setStop).not.toHaveBeenCalled();
  expect(native[method]).toHaveBeenCalledWith(expect.objectContaining({ center: nearby, zoom: 18, padding }));
  expect(native.jumpTo).not.toHaveBeenCalled();
});

it('preserves direct distant movement and bounds fitting in 2D', () => {
  controller.mapCamera.flyTo(campus, 18);
  controller.mapCamera.fitBounds(campusBounds);
  expect(native.setStop).not.toHaveBeenCalled();
  expect(native.flyTo).toHaveBeenCalledWith({ center: campus, zoom: 18, pitch: undefined, padding });
  expect(native.fitBounds).toHaveBeenCalledWith(campusBounds, { padding, duration: 800 });
});

it('moves near distant bounds while flat and applies the requested orientation before native fitting', async () => {
  const flat = deferred();
  const arrived = deferred();
  const oriented = deferred();
  native.setStop.mockReturnValueOnce(flat.promise).mockReturnValueOnce(arrived.promise).mockReturnValueOnce(oriented.promise);
  store.setState({ is3d: true });

  controller.mapCamera.fitBounds(campusBounds, { top: 140, left: 24, right: 76 }, { pitch: 48, bearing: 17 });
  expect(native.fitBounds).not.toHaveBeenCalled();
  flat.resolve();
  await settleCommands();
  expect(native.setStop).toHaveBeenLastCalledWith({ bounds: campusBounds, pitch: 0, duration: 0, padding: { top: 140, bottom: 300, left: 24, right: 76 } });
  expect(native.fitBounds).not.toHaveBeenCalled();
  arrived.resolve();
  await settleCommands();
  expect(native.setStop).toHaveBeenLastCalledWith({ pitch: 48, bearing: 17, duration: 0 });
  expect(native.fitBounds).not.toHaveBeenCalled();
  oriented.resolve();
  await settleCommands();
  expect(native.fitBounds).toHaveBeenCalledWith(campusBounds, {
    pitch: 48, bearing: 17, duration: 800, padding: { top: 140, bottom: 300, left: 24, right: 76 },
  });
});

it.each([0, 48])('applies explicit pitch %s before nearby fitting even if store preference already changed', async (pitch) => {
  const accepted = deferred();
  native.setStop.mockReturnValueOnce(accepted.promise);
  store.setState({ is3d: pitch > 0 });
  controller.mapCamera.fitBounds(taipeiBounds, undefined, { pitch, bearing: 12 });
  expect(native.setStop).toHaveBeenCalledWith({ pitch, bearing: 12, duration: 0 });
  expect(native.fitBounds).not.toHaveBeenCalled();
  accepted.resolve();
  await settleCommands();
  expect(native.fitBounds).toHaveBeenCalledWith(taipeiBounds, { pitch, bearing: 12, padding, duration: 800 });
});

it.each(['flyTo', 'easeTo'] as const)('makes a newer nearby %s wait for old preparation and prevents the stale target', async (method) => {
  const accepted = deferred();
  native.setStop.mockReturnValueOnce(accepted.promise);
  store.setState({ is3d: true });
  controller.mapCamera.flyTo(campus, 18);
  controller.mapCamera[method](nearby, 19);
  expect(native[method]).not.toHaveBeenCalled();
  accepted.resolve();
  await settleCommands();
  expect(native[method]).toHaveBeenCalledTimes(1);
  expect(native[method]).toHaveBeenCalledWith(expect.objectContaining({ center: nearby, zoom: 19, pitch: 60, padding }));
  expect(native.flyTo.mock.calls.every(([options]) => options.center !== campus)).toBe(true);
});

it('serializes two distant requests and only moves to the newest target', async () => {
  const firstAccepted = deferred();
  const secondAccepted = deferred();
  native.setStop.mockReturnValueOnce(firstAccepted.promise).mockReturnValueOnce(secondAccepted.promise);
  store.setState({ is3d: true });
  controller.mapCamera.flyTo(campus, 18);
  const second: LngLat = [120.7, 24.2];
  controller.mapCamera.flyTo(second, 19, 48);
  expect(native.setStop).toHaveBeenCalledTimes(1);
  firstAccepted.resolve();
  await settleCommands();
  expect(native.setStop).toHaveBeenCalledTimes(2);
  expect(native.flyTo).not.toHaveBeenCalled();
  secondAccepted.resolve();
  await settleCommands();
  expect(native.flyTo).toHaveBeenCalledTimes(1);
  expect(native.flyTo).toHaveBeenCalledWith({ center: second, zoom: 19, pitch: 48, padding });
});

it('lets a new pitch intent cancel a prepared target without an older flat stop landing afterward', async () => {
  const accepted = deferred();
  native.setStop.mockReturnValueOnce(accepted.promise);
  store.setState({ is3d: true });
  controller.mapCamera.flyTo(campus, 18);
  const finished = controller.mapCamera.setPitch(48);
  expect(native.setStop).toHaveBeenCalledTimes(1);
  accepted.resolve();
  await finished;
  expect(native.flyTo).not.toHaveBeenCalled();
  expect(native.setStop).toHaveBeenLastCalledWith({ pitch: 48, duration: 600, easing: 'ease' });
});

it('starts native following only after pending preparation and cancels the prior target', async () => {
  const accepted = deferred();
  native.setStop.mockReturnValueOnce(accepted.promise);
  store.setState({ is3d: true });
  controller.mapCamera.flyTo(campus, 18);
  controller.mapCamera.follow('course', 17, 45);
  expect(store.getState().follow).toBeNull();
  accepted.resolve();
  await settleCommands();
  expect(store.getState().follow).toEqual({ mode: 'course', zoom: 17, pitch: 45 });
  expect(native.flyTo).not.toHaveBeenCalled();
});

it('cancels queued follow when following is stopped before preparation finishes', async () => {
  const accepted = deferred();
  native.setStop.mockReturnValueOnce(accepted.promise);
  store.setState({ is3d: false, follow: { mode: 'heading', zoom: 18, pitch: 45 } });
  controller.mapCamera.flyTo(campus, 18);
  controller.mapCamera.follow('course', 17, 45);
  controller.mapCamera.stopFollow();
  expect(store.getState().follow).toBeNull();
  expect(native.setStop).toHaveBeenCalledTimes(1);
  accepted.resolve();
  await settleCommands();
  expect(store.getState().follow).toBeNull();
  expect(native.flyTo).not.toHaveBeenCalled();
  expect(native.setStop).toHaveBeenLastCalledWith({ pitch: 0, bearing: 0, duration: 600, easing: 'ease' });
});

it('retains a live request when React replaces the native imperative handle', async () => {
  const accepted = deferred();
  native.setStop.mockReturnValueOnce(accepted.promise);
  store.setState({ is3d: true });
  controller.mapCamera.flyTo(campus, 18, 48);
  const replacement = createCamera();
  controller.registerMapCamera(null);
  controller.registerMapCamera(replacement);
  accepted.resolve();
  await settleCommands();
  expect(native.flyTo).not.toHaveBeenCalled();
  expect(replacement.flyTo).toHaveBeenCalledWith({ center: campus, zoom: 18, pitch: 48, padding });
});

it('allows only one initial GPS center and lets an explicit user target supersede it', async () => {
  const accepted = deferred();
  native.setStop.mockReturnValueOnce(accepted.promise);
  store.setState({ is3d: true });
  expect(controller.mapCamera.autoCenterOnce(campus, 18)).toBe(true);
  expect(controller.mapCamera.autoCenterOnce(campus, 18)).toBe(false);
  controller.mapCamera.flyTo(nearby, 19);
  accepted.resolve();
  await settleCommands();
  expect(controller.isCameraClaimed()).toBe(true);
  expect(native.flyTo).toHaveBeenCalledTimes(1);
  expect(native.flyTo).toHaveBeenCalledWith(expect.objectContaining({ center: nearby }));
});

it('conservatively prepares a tilted camera when viewport bounds are not yet known', async () => {
  store.setState({ is3d: true, bounds: null });
  controller.mapCamera.easeTo(campus, 18);
  await settleCommands();
  expect(native.setStop).toHaveBeenCalledWith({ pitch: 0, duration: 0 });
  expect(native.easeTo).toHaveBeenCalledWith({ center: campus, zoom: 18, duration: 500, pitch: 60, padding });
});

it('uses nonanimated movement after preparation when reduced motion is enabled', async () => {
  mockReduceMotion = true;
  store.setState({ is3d: true });
  controller.mapCamera.flyTo(campus, 18, 48);
  await settleCommands();
  expect(native.jumpTo).toHaveBeenCalledWith({ center: campus, zoom: 18, pitch: 48, padding });
  expect(native.flyTo).not.toHaveBeenCalled();
});

it('reports rejected preparation without moving its target or leaving the next request blocked', async () => {
  const error = new Error('native camera unavailable');
  native.setStop.mockRejectedValueOnce(error);
  store.setState({ is3d: true });
  controller.mapCamera.flyTo(campus, 18);
  await settleCommands();
  expect(native.flyTo).not.toHaveBeenCalled();
  expect(warn).toHaveBeenCalledWith('[mapCamera] camera movement failed', error);
  controller.mapCamera.flyTo(nearby, 19);
  expect(native.flyTo).toHaveBeenCalledTimes(1);
});

it('handles the native promise returned by convenience methods despite their void type', async () => {
  const error = new Error('native command rejected');
  native.flyTo.mockReturnValueOnce(Promise.reject(error));
  controller.mapCamera.flyTo(campus, 18);
  await settleCommands();
  expect(warn).toHaveBeenCalledWith('[mapCamera] camera movement failed', error);
});


it('remembers a navigation pitch even when the general map preference remains 2D', async () => {
  controller.mapCamera.flyTo(nearby, 20.2, 60);
  expect(store.getState().is3d).toBe(false);
  native.flyTo.mockClear();
  controller.mapCamera.flyTo(campus, 18);
  expect(native.flyTo).not.toHaveBeenCalled();
  await settleCommands();
  expect(native.setStop).toHaveBeenCalledWith({ pitch: 0, duration: 0 });
  expect(native.flyTo).toHaveBeenCalledWith({ center: campus, zoom: 18, pitch: 60, padding });
});

it('preserves an explicit indoor angle across a later movement without an angle argument', async () => {
  await controller.mapCamera.setPitch(48);
  controller.mapCamera.easeTo(campus, 18);
  await settleCommands();
  expect(native.easeTo).toHaveBeenCalledWith({ center: campus, zoom: 18, duration: 500, pitch: 48, padding });
});

it.each([false, true])('fits the full extent flat when its center is visible but its corners are outside, starting in 3D=%s', async (is3d) => {
  const wideBounds: LngLatBounds = [121.4, 24.9, 121.7, 25.2];
  store.setState({ is3d });
  controller.mapCamera.fitBounds(wideBounds, undefined, { pitch: 48, bearing: 0 });
  await settleCommands();
  expect(native.setStop).toHaveBeenNthCalledWith(1, { pitch: 0, duration: 0 });
  expect(native.setStop).toHaveBeenNthCalledWith(2, { bounds: wideBounds, padding, pitch: 0, duration: 0 });
  expect(native.setStop).toHaveBeenNthCalledWith(3, { pitch: 48, bearing: 0, duration: 0 });
  expect(native.fitBounds).toHaveBeenCalledWith(wideBounds, { pitch: 48, bearing: 0, padding, duration: 800 });
});


it('still flattens a distant move while an animated switch to 2D may be in progress', async () => {
  await controller.mapCamera.setPitch(48);
  await controller.mapCamera.setPitch(0);
  native.setStop.mockClear();
  controller.mapCamera.flyTo(campus, 18);
  expect(native.setStop).toHaveBeenCalledWith({ pitch: 0, duration: 0 });
  expect(native.flyTo).not.toHaveBeenCalled();
  await settleCommands();
  expect(native.flyTo).toHaveBeenCalledWith({ center: campus, zoom: 18, pitch: 0, padding });
});
