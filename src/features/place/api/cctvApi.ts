import { fetchRequest } from '@/shared/api';

export interface CctvCamera {
  id: string;
  /** 路口／地點名稱，例如「三民路/五權路/崇德路(右側車流往北屯路)」 */
  name: string;
  /** 畫面快照網址 */
  imageUrl: string;
  /** MJPEG 即時串流網址；來源沒有串流（後端 `streamUrl` 為空或等於快照）時為 undefined */
  streamUrl?: string;
  /** 距查詢座標的距離（公尺） */
  distanceMeters?: number;
}

// 後端 `GET /a11y/cctv`（twipcam 全國監視器，半徑內由近到遠，預設 500 m）。
const CCTV_PATH = '/api/v1/a11y/cctv';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseCamera(value: unknown): CctvCamera | undefined {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.name !== 'string') return undefined;
  if (typeof value.snapshotUrl !== 'string') return undefined;
  return {
    id: value.id,
    name: value.name,
    imageUrl: value.snapshotUrl,
    streamUrl: typeof value.streamUrl === 'string' && value.streamUrl !== value.snapshotUrl ? value.streamUrl : undefined,
    distanceMeters: typeof value.distanceM === 'number' ? value.distanceM : undefined,
  };
}

/**
 * 依座標查附近路口監視器。後端來源失敗時 `data.status === 'unavailable'`（HTTP 仍 200），
 * 這裡丟錯讓畫面顯示「載入失敗」，而不是誤報成「附近沒有監視器」。
 */
export async function fetchNearbyCctv(lat: number, lng: number, signal?: AbortSignal): Promise<CctvCamera[]> {
  const response = await fetchRequest(`${CCTV_PATH}?lat=${lat}&lng=${lng}`, { signal });
  const block = response.data;
  if (!isRecord(block) || block.status !== 'ok' || !Array.isArray(block.cameras)) {
    throw new Error('CCTV source unavailable');
  }
  return block.cameras.flatMap((camera) => parseCamera(camera) ?? []);
}
