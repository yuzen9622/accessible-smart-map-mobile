/**
 * State-transition GPS error tracker and position handlers.
 *
 * 移植自 Web src/lib/map/gpsErrorHandler.ts（5eadc71）。原生版差異：輸入改為 LocationPort 的
 * GeoPosition、儲存改注入 KeyValueStorage（MMKV），不再預設讀 window.localStorage。
 *
 * Prevents toast notification spam when the location watch
 * continuously fires error callbacks (e.g. in tunnels, basements, or when
 * location permission is denied).
 *
 * Notifications are only dispatched on the transition from a healthy/initial
 * state to an error state. Once a valid GPS fix is received, the error state
 * is reset so future signal losses will trigger a single notification again.
 */

import type { LatLng } from "@/shared/geo";
import type { GeoPosition } from "@/shared/location";
import type { KeyValueStorage } from "@/shared/storage";

export interface GpsErrorTracker {
  /** Record a successful GPS position fix; resets the error state. */
  recordSuccess: () => void;
  /**
   * Record a GPS error. Calls `notify` ONLY if transitioning into the error state.
   * Returns `true` if this was a new error transition, `false` if suppressed.
   */
  recordError: (notify?: () => void) => boolean;
  /** Check whether the tracker is currently in an error state. */
  hasError: () => boolean;
  /** Explicitly reset the error state. */
  reset: () => void;
}

/**
 * Creates a state-transition GPS error tracker instance.
 */
export function createGpsErrorTracker(): GpsErrorTracker {
  let isErrorActive = false;

  return {
    recordSuccess: () => {
      isErrorActive = false;
    },
    recordError: (notify?: () => void) => {
      if (!isErrorActive) {
        isErrorActive = true;
        notify?.();
        return true;
      }
      return false;
    },
    hasError: () => isErrorActive,
    reset: () => {
      isErrorActive = false;
    },
  };
}

export interface GpsPositionHandlersOptions {
  onLocationUpdate: (loc: LatLng) => void;
  onHeadingUpdate?: (heading: number | null) => void;
  onErrorNotification?: (error?: unknown) => void;
  storageKey?: string;
  storage?: KeyValueStorage | null;
  tracker?: GpsErrorTracker;
}

/**
 * Creates coordinated position and error handlers for LocationPort.watch.
 */
export function createGpsPositionHandlers(options: GpsPositionHandlersOptions) {
  const {
    onLocationUpdate,
    onHeadingUpdate,
    onErrorNotification,
    storageKey = "lastUserLocation",
    storage = null,
    tracker = createGpsErrorTracker(),
  } = options;

  const handlePosition = (pos: GeoPosition) => {
    tracker.recordSuccess();

    const loc: LatLng = {
      lat: pos.lat,
      lng: pos.lng,
    };
    onLocationUpdate(loc);

    if (storage) {
      try {
        storage.set(storageKey, JSON.stringify(loc));
      } catch {
        // storage write failure is non-fatal.
      }
    }

    if (onHeadingUpdate) {
      const h = pos.heading;
      onHeadingUpdate(typeof h === "number" && !Number.isNaN(h) ? h : null);
    }
  };

  const handleError = (error?: unknown) => {
    tracker.recordError(() => {
      onErrorNotification?.(error);
    });
  };

  return {
    handlePosition,
    handleError,
    tracker,
  };
}
