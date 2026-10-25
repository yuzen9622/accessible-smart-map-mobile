export interface CctvCamera {
  id: string;
  /** 路口／地點名稱，例如「忠孝西路一段 × 公園路」 */
  name: string;
  /** 畫面快照或串流縮圖網址 */
  imageUrl: string;
  /** 距查詢座標的距離（公尺） */
  distanceMeters?: number;
}

/**
 * TODO(CCTV API)：後端路口監視器 API 尚未對接——這個 repo 裡找不到任何既有的 CCTV／監視器端點
 * 或參考實作（2026-10-25 已確認過：grep 整個 `src/` 沒有任何 cctv／監視器相關程式碼，Web 版
 * 參考專案在這台機器上也不存在，無法照抄）。
 *
 * UI（`CctvScreen`／`PlaceDetailView` 的監視器按鈕）已經接好這個函式：拿到真正的 endpoint 後，
 * 把下面的實作換成真正的 `fetchRequest` 呼叫即可，不用動呼叫端。預期功能：依座標查附近路口
 * 監視器，回傳 `CctvCamera[]`（依距離排序）。
 */
export async function fetchNearbyCctv(_lat: number, _lng: number, _signal?: AbortSignal): Promise<CctvCamera[]> {
  return [];
}
