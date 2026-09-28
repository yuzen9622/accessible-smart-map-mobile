/**
 * 移植自 Web `src/components/ClientMap.tsx:44-59`（commit 5eadc71）`toPlaceId`，
 * 邏輯逐行搬移。用來驗證／正規化「地點 id」字串：只接受目前格式
 * (`google:*`、`osm:node|way|relation:數字`) 或舊式 `node_123`／`way_123`／
 * `relation_123`（含縮寫 `n_`/`w_`/`r_`）並轉成目前格式。
 *
 * **不變量**（SDD §6.2、Phase brief §4）：`coord:lat,lng` 這種座標型 id
 * 一律回傳 `null`——呼叫端必須據此跳過 `/search/details/:id`（後端對
 * `coord:` id 會 400），改走反查地址（`reverseGeocode`）流程。
 */
export function toPlaceId(value: string | null | undefined): string | null {
  if (!value) return null;
  if (/^(google:.+|osm:(node|way|relation):\d+)$/.test(value)) return value;

  const [type, id] = value.split('_');
  if (!id || !/^\d+$/.test(id)) return null;
  const osmType =
    type === 'node' || type === 'n'
      ? 'node'
      : type === 'way' || type === 'w'
        ? 'way'
        : type === 'relation' || type === 'r'
          ? 'relation'
          : null;
  return osmType ? `osm:${osmType}:${id}` : null;
}

/** `coord:` 前綴的 id（`legacyPlaceDetailToPlaceResult`／`nominatimToPlaceResult` 在沒有 OSM 參照時產生）不得呼叫 `/search/details/:id`。 */
export function isCoordPlaceId(id: string): boolean {
  return id.startsWith('coord:');
}
