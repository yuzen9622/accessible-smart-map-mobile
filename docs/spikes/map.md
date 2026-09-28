# Spike A — 地圖（R2）

| 項目 | 內容 |
|---|---|
| 日期 | 2026-09-26 |
| 環境 | Expo SDK 57、RN 0.86.3（New Architecture）、`@maplibre/maplibre-react-native` 11.4.0、iOS 27 模擬器（iPhone 18 Pro） |
| 程式 | `src/features/spikes/map/`、路由 `/spikes/map`（深層連結 `accessiblesmartmap://spikes/map`） |
| 結論 | **可行，採用 maplibre-react-native 11.x**（ADR-03 維持）。FPS／記憶體需真機量測（見「未驗證」） |

## 驗證結果

| 項目 | 結果 | 備註 |
|---|---|---|
| 安裝與建置 | ✅ | `npx expo install` 自動加 config plugin；plugin 不改 AppDelegate，與 `with-ios-scene-lifecycle` 相容 |
| Web 版 OpenFreeMap style（liberty／dark） | ✅ | `mapStyle` 可直接吃 style JSON 物件；深淺色切換會重載 style，覆蓋圖層（設施點）會自動重新掛上 |
| 修改 style 再傳入 | ✅ | 先 fetch style JSON，移除 liberty 內建 `building-3d`、把平面 `building` 的 `maxzoom` 拉到 24（與 Web `basemap3d.ts` 相同），再以物件傳入 |
| `fill-extrusion` 3D 建物 | ✅ | `<Layer type="fill-extrusion" source="openmaptiles" source-layer="building">`，paint 直接沿用 Web 的 style-spec 寫法（v11 支援 `paint`／`layout` props，不必用舊的 `style` prop） |
| 2D/3D 交叉淡化、不 reload style | ✅ | 只改 `fill-extrusion-opacity`（搭配 `fill-extrusion-opacity-transition`），pitch 以 `CameraRef.setStop({ pitch })` 動畫；設施點與分群全程不受影響 |
| 設施資料量 | ✅ | `all-facilities?category=elevator,ramp,toilet` 實測 **5,836 筆、約 1.1 MB**（SDD 原寫 7.9k／1.6 MB，已更正）；模擬器下載 1.4–2.1 s、`JSON.parse`＋轉 GeoJSON 7–18 ms |
| `GeoJSONSource` 原生分群 | ✅ | `cluster`、`clusterRadius=50`、`clusterMaxZoom=16`；點 cluster 以 `getClusterExpansionZoom()` 放大（實測 → zoom 17）；點單點的 `onPress` 帶回 feature properties |
| `Camera.flyTo`／`fitBounds` | ✅ | 皆可用；`easeTo` 型別要求 `center`，只改 pitch 要用 `setStop` |
| 地圖 padding（sheet 遮擋） | ⚠️ | **`<Camera padding>` prop 變更後不影響 `flyTo` 的置中**；把 `padding` 放進 `flyTo(...)` options 才生效。Phase 1 的 `MapController` 要在每個相機動作帶入目前 sheet inset |
| 浮動按鈕（`@expo/ui` `Button` + `buttonStyle('glass')` + `GlassEffectContainer`） | ✅ | iOS 呈現 Liquid Glass，深淺色皆正確 |

## 注意事項（Phase 1 要處理）

1. `GeoJSONSource` 每次 render 都會 `JSON.stringify(data)`（原始碼 `GeoJSONSource.tsx:235`）。1.1 MB 的設施集合必須保持同一個 reference（放 store、不要在 render 內重建），否則每次重繪都序列化一次。
2. `fitBounds` 實測縮放範圍比兩點外框大很多，原因未查明（可能與 padding／預設 options 有關），Phase 1 做路線 `fitBounds` 時要重驗。
3. dev build 的開發選單浮動齒輪會攔截右上角約 100 pt 範圍的點擊（正式版不存在）。測試時浮動按鈕避開右上角。
4. 分群目前用 circle layer；正式版要改 `Images` 註冊 icon + `SymbolLayer iconImage`（依 `category`），並補 VoiceOver 替代清單（SDD §10）。

## 未驗證

- FPS 與記憶體：模擬器以 Mac GPU 繪製，數字不具代表性。需在 iPhone 真機（中階機種）以 Perf Monitor／Instruments 量測 5.8k 點平移縮放是否 ≥ 50 fps。未繳 Apple 年費前可用免費帳號裝到自己的 iPhone，或先在 Android 真機量。
- Android：尚未建置（本機沒有 Android emulator，使用者決定 Phase 0 先跳過）。
