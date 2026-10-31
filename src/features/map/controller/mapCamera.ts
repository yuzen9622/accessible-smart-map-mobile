import type { CameraRef, LngLat, LngLatBounds, ViewPadding } from '@maplibre/maplibre-react-native';
import { Platform } from 'react-native';

import { isReduceMotionEnabled, motionDuration } from '@/shared/accessibility';
import { logger } from '@/shared/logger';

import { MAP_PITCH_3D } from '../domain/basemap';
import { useMapUiStore, type MapFollowMode } from '../store/mapUiStore';

/** MapController port. Every movement includes the current sheet inset. */
let camera: CameraRef | null = null;
let claimed = false;
let commandSequence = 0;
let preparation: Promise<void> | null = null;
let intendedPitch: number | null = null;
let nativePitch: number | null = null;

type CameraStop = Parameters<CameraRef['setStop']>[0];
type CameraAction = () => void | Promise<void>;

export function registerMapCamera(ref: CameraRef | null): void {
  // React's native handle changes on renders; only a new intent cancels work.
  camera = ref;
}

export function isCameraClaimed(): boolean {
  return claimed;
}

function currentPadding(extraTop = 0): ViewPadding {
  return { top: extraTop, bottom: useMapUiStore.getState().sheetInset, left: 0, right: 0 };
}

function intendedCameraPitch(): number {
  const { follow, is3d } = useMapUiStore.getState();
  return follow?.pitch ?? intendedPitch ?? (is3d ? MAP_PITCH_3D : 0);
}

function currentPitch(): number {
  return nativePitch ?? intendedCameraPitch();
}

function sendToCamera(action: (ref: CameraRef) => void | Promise<void>, pitch?: number, immediate = false): void | Promise<void> {
  if (!camera) return;
  const sequence = commandSequence;
  // Animated pitch changes may still be tilted when the next intent arrives.
  // Only an accepted zero-duration stop can lower the known possible pitch.
  if (pitch !== undefined) nativePitch = Math.max(currentPitch(), pitch);
  const result = action(camera);
  if (!immediate || pitch === undefined) return result;
  return Promise.resolve(result).then(() => {
    if (sequence === commandSequence) nativePitch = pitch;
  });
}

function outsideCurrentBounds([lng, lat]: LngLat): boolean {
  const bounds = useMapUiStore.getState().bounds;
  if (!bounds || !bounds.every(Number.isFinite)) return true;
  const [west, south, east, north] = bounds;
  const longitudeVisible = west <= east ? lng >= west && lng <= east : lng >= west || lng <= east;
  return !longitudeVisible || lat < south || lat > north;
}

function needsFlatApproach(center: LngLat): boolean {
  return Platform.OS === 'ios' && currentPitch() > 0 && outsideCurrentBounds(center);
}

function reportFailure(error: unknown): void {
  logger.warn('[mapCamera] camera movement failed', error);
}

function perform(action: CameraAction): Promise<void> {
  try {
    // CameraRef's convenience methods are typed void but return native promises.
    return Promise.resolve(action()).catch(reportFailure);
  } catch (error) {
    reportFailure(error);
    return Promise.resolve();
  }
}

/** A shared barrier also holds newer, otherwise synchronous actions until an
 * already-issued native preparation settles. Only the latest intent may move. */
function dispatch(action: CameraAction, stops: CameraStop[] = []): Promise<void> {
  const sequence = ++commandSequence;
  const previous = preparation;
  if (!previous && stops.length === 0) return perform(action);
  const ready = (async () => {
    if (previous) await previous;
    for (const stop of stops) {
      if (sequence !== commandSequence || !camera) return false;
      await sendToCamera((ref) => ref.setStop(stop), stop.pitch, true);
    }
    return sequence === commandSequence;
  })().catch((error: unknown) => { reportFailure(error); return false; });
  if (stops.length > 0) {
    const barrier = ready.then(() => undefined);
    preparation = barrier;
    void barrier.then(() => { if (preparation === barrier) preparation = null; });
  }
  return ready.then((canMove) => canMove && sequence === commandSequence ? perform(action) : undefined);
}

/** Center-only moves still need iOS preparation when the current view is tilted.
 * Bounds fitting uses the patched native camera-copy calculation instead. */
function centerMovement(center: LngLat, move: (pitch?: number) => void, pitch?: number): void {
  const flatten = needsFlatApproach(center);
  const restorePitch = flatten || preparation !== null;
  const targetPitch = pitch ?? (restorePitch ? intendedCameraPitch() : undefined);
  if (pitch !== undefined) intendedPitch = pitch;
  void dispatch(() => move(targetPitch), flatten ? [{ pitch: 0, duration: 0 }] : []);
}

export const mapCamera = {
  flyTo(center: LngLat, zoom?: number, pitch?: number): void {
    claimed = true;
    const padding = currentPadding();
    centerMovement(center, (targetPitch) => isReduceMotionEnabled()
      ? sendToCamera((ref) => ref.jumpTo({ center, zoom, pitch: targetPitch, padding }), targetPitch, true)
      : sendToCamera((ref) => ref.flyTo({ center, zoom, pitch: targetPitch, padding }), targetPitch), pitch);
  },
  easeTo(center: LngLat, zoom?: number, duration = 500): void {
    claimed = true;
    const padding = currentPadding();
    centerMovement(center, (pitch) => {
      const options = { center, zoom, padding, ...(pitch === undefined ? {} : { pitch }) };
      return sendToCamera((ref) => isReduceMotionEnabled() ? ref.jumpTo(options) : ref.easeTo({ ...options, duration }), pitch, isReduceMotionEnabled());
    });
  },
  /** `edge` adds margins beyond the sheet inset. */
  fitBounds(bounds: LngLatBounds, edge?: { top?: number; bottom?: number; left?: number; right?: number }, orientation?: { pitch: number; bearing: number }): void {
    claimed = true;
    const targetPitch = orientation?.pitch ?? intendedCameraPitch();
    const padding = { ...currentPadding(edge?.top ?? 0), bottom: useMapUiStore.getState().sheetInset + (edge?.bottom ?? 0), left: edge?.left ?? 0, right: edge?.right ?? 0 };
    if (orientation) intendedPitch = orientation.pitch;
    // The native patch fits a camera copy at the target pitch, so no visible preparation is needed.
    void dispatch(() => sendToCamera((ref) => ref.fitBounds(bounds, { ...orientation, pitch: targetPitch, padding, duration: motionDuration(800) }), targetPitch, isReduceMotionEnabled()));
  },
  /** Only the first unclaimed GPS fix can center the map. */
  autoCenterOnce(center: LngLat, zoom: number): boolean {
    if (claimed || !camera) return false;
    mapCamera.flyTo(center, zoom);
    return true;
  },
  /** Native user tracking handles heading/course without per-frame JS jumps. */
  follow(mode: MapFollowMode, zoom: number, pitch: number): void {
    claimed = true;
    intendedPitch = pitch;
    void dispatch(() => {
      nativePitch = Math.max(currentPitch(), pitch);
      useMapUiStore.getState().setFollow({ mode, zoom, pitch });
    });
  },
  /** Release tracking without a separate camera animation; the next movement owns the view. */
  stopFollow(): { pitch: number; bearing: number } {
    commandSequence += 1;
    const { is3d, setFollow } = useMapUiStore.getState();
    const pitch = is3d ? MAP_PITCH_3D : 0;
    intendedPitch = pitch;
    setFollow(null);
    return { pitch, bearing: 0 };
  },
  setPitch(pitch: number): Promise<void> {
    intendedPitch = pitch;
    return dispatch(() => sendToCamera((ref) => ref.setStop({ pitch, duration: motionDuration(600), easing: 'ease' }), pitch, isReduceMotionEnabled()));
  },
};
