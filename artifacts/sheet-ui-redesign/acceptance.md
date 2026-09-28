# Bottom Sheet UI redesign — 驗收紀錄

> 狀態：**ACCEPTANCE: PARTIAL**（與 [README.md](README.md) 第一行一致）。AX XXXL peek 有裁切（FAIL）；觸控／拖曳／鍵盤／VoiceOver 的互動驗收未執行（無 GUI driver），機械項 #10 因範圍外的 `SavedPlacesPanel` 失敗。下方 before 證據不可冒充 after。

## 參考與修改前基線

| 畫面 | 證據 | 已實際開圖 |
| --- | --- | --- |
| Home 參考圖 | [reference-home.png](reference-home.png) | 是；與桌面原檔 SHA-1 相同 |
| Detail 參考圖 | [reference-detail.png](reference-detail.png) | 是；與桌面原檔 SHA-1 相同 |
| iOS Home before | [ios-before-home.png](ios-before-home.png) | 是；iPhone 18 Pro / iOS 27.0，灰色 SwiftUI Form |
| iOS Detail before | [ios-before-detail-real.png](ios-before-detail-real.png) | 是；`google:ChIJSY-O5b09aTQR8I0ZFEuU4DA`，南屯素食館 |
| Web Home before | [web-before-home-light.png](web-before-home-light.png) | 是；`https://map.yuzen.dev/zh-TW/`，390 × 844 viewport，light |
| Web Detail before | [web-before-place-light.png](web-before-place-light.png) | 是；Web 搜尋「南屯素食館」並點選 autocomplete，與 iOS 同一地點 |

iOS 使用 `xcrun simctl launch/openurl/io screenshot` 開啟正式安裝的 `com.accessiblemap.app`；第一次以不帶 `google:` 的 ID 開啟失敗，改用正式 ID 成功，前者不是產品 regression。Web 以隔離的 `agent-browser` session 實際開啟網站、跳過 onboarding、搜尋「南屯素食館」、點選 autocomplete 結果、返回、由最近搜尋再次進入 Detail，並取截圖。Web 與參考圖在 light/dark 設定、welcome card、最近搜尋及位置資料上有動態差異。**此環境 Xcode 安裝沒有 `Simulator.app` GUI，`simctl` 能 launch/openurl/screenshot、切外觀及字級，但無觸控輸入；iOS 手勢、搜尋鍵盤、收藏／分享／登入等點擊目前未驗證，不能把深連結導覽冒稱為實際點擊。**

## 元件與既有契約

| 對應 | RN | Web |
| --- | --- | --- |
| Sheet host | `src/app/_layout.tsx` 原生 formSheet；detents `[.15,.5,1]`；Map 在底層持續存在 | `src/components/BottomSheet/BottomSheet.tsx` |
| Home | 原 `ExplorePanel.ios.tsx`（SwiftUI Form，已刪）→ 現 `ExplorePanel.tsx`（RN + Lucide，跨平台）；`hooks/useExploreViewModel.ts` 搜尋、歷史、附近及收藏導覽 | `src/components/BottomSheet/HomeContent.tsx`、`NearbyContextBlock.tsx` |
| Detail | 原 `PlaceDetailView.ios.tsx`（SwiftUI Form，已刪）→ 現 `PlaceDetailView.tsx` + `ShareButton.ios.tsx`（ShareLink + RNHostView Lucide）；`hooks/usePlaceDetailViewModel.ts` 收藏、分享、外鏈、評論 | `src/components/BottomSheet/PlaceContent.tsx`、`PlaceReviewSection.tsx` |

## Expo skills（實際閱讀）

| 名稱／來源 | 採用／限制 |
| --- | --- |
| `.pi/skills/expo-overview/SKILL.md` | 確認 SDK 57 與開發用 dev build，不升級 SDK |
| `.pi/skills/expo-native-ui/SKILL.md` | safe area、可存取性、鍵盤及內容捲動原則；不採 SF Symbol 建議，因本任務要求 Lucide |
| `.pi/skills/expo-ui/SKILL.md` | 評估原生控制項；沿用原有 Expo Router formSheet，不更換 Sheet host |
| `.pi/skills/expo-router/SKILL.md` 與 `references/form-sheet.md` | 保留 Stack、detents、地圖可互動之 presentation |
| `.pi/skills/expo-dev-client/SKILL.md` | 地圖等既有原生依賴需要開發 build；不改走 Expo Go／EAS |

## 修改、互動、逐項比對、工程檢查

修改前工程基線：`npm run typecheck` **PASS**、`npm run lint` **PASS**、`npm test -- --runInBand` **PASS**。這只代表原版工程檢查，不是 UI 驗收。

修改後（最後一次程式修改後重跑）：`npm run typecheck` **PASS**、`npm run lint` **PASS**（0 warning）、`npm test -- --runInBand` **PASS**（34 suites／188 tests）、`git diff --check` **PASS**。較早的原生依賴安裝後另執行 `npx expo-doctor` **PASS**（21/21）、`npx expo install --check` **PASS**、`npx expo run:ios --device "iPhone 18 Pro"` **Build Succeeded**；最後僅 JS／色彩變更，Metro 執行中的 dev build 已重新開啟取圖，但未再重建 native binary。

iOS after 截圖（最終程式，`simctl` 擷取並已開圖核對）：`ios-after-home-peek.png`、`ios-after-place.png`（deep link 落在 peek）、`ios-after-place-dark.png`、`ios-after-place-a11y-xxxl.png`、`ios-after-home-explore-link.png`、`ios-after-home-peek-a11y-xxxl.png`；中間版 `ios-after-place-v1-header-under-navbar.png`（half，證實並已修正「標頭被透明導覽列蓋住」）。Web 未重拍（基準有效，計畫禁止本機起 Web server）。

互動：搜尋輸入、選建議、收藏、分享、複製、外鏈、快捷 chips、detent 拖曳、VoiceOver **全部未驗證**（無 `Simulator.app` GUI，無 idb／maestro／appium）；只有 deep link 導覽（`place/…`、`explore`）實際執行，不冒稱點擊。`ios-final-detail.png`、`ios-final-detail-axxxl.png` 是最後版實際開圖證據，但只達 peek。AX XXXL peek 下緣裁切 **FAIL**。逐項 V1–V12、機械項 #1–#20、對比計算與風險見 [README.md](README.md)。

## Web ↔ iOS 逐項比對（最後版）

Web 以 [Home](web-before-home-light.png)、[Detail](web-before-place-light.png) 為實機基準；iOS 使用 [Home peek](ios-after-home-peek.png)、[Detail peek](ios-final-detail.png)、[AX XXXL Detail](ios-final-detail-axxxl.png)。對照設計圖：[Home](reference-home.png)、[Detail](reference-detail.png)。狀態標記僅涵蓋可見區域；下方內容不能用修正前 half 圖冒充最終畫面。

| 項目 | 結果 | 觀察與差異 |
| --- | --- | --- |
| 資訊順序與區塊 | **未驗證** | iOS peek 的搜尋／地點標頭可見；Home 品牌在 half/full 才呈現。最終 body（快捷／收藏／評價）無法拖出查看 |
| Header 與字級 | **FAIL（AX XXXL）** | 一般字級 Detail peek 標題可讀；[AX XXXL](ios-final-detail-axxxl.png) 標題與地址被底緣裁切 |
| Spacing／alignment | **未驗證** | peek 搜尋列與標頭對齊可見；完整 cards、chips、rows 未到達 |
| 品牌與狀態色 | **部分 PASS** | `palette.ts` 改 `#0065C8` 白底／白字 5.68:1，深色文字 `#6BB2FF`；實際狀態卡在 body 未查看 |
| Buttons | **未驗證** | 主要 CTA、收藏、分享在 peek 以下；大字級主鈕改為獨佔一列，缺畫面及點擊證據 |
| Icons | **部分 PASS** | peek 的 Search／MapPin 為 Lucide；`Icon.tsx` 具名 deep import，其餘仍缺最終版可見畫面 |
| Home 內容 | **未驗證** | peek 搜尋與「你附近」可見，但操作、較下方快捷與歷史未能驗證 |
| Detail 內容 | **未驗證** | 同地點標頭可見；metadata、CTA、地址、清單、評價在 peek 以下 |
| iOS 適配 | **FAIL（大字 peek）** | safe area 一般標頭正常；鍵盤／scroll／detent 互動無 GUI driver |
| 功能保留 | **未驗證** | 正式深連結可到 Home／Detail、地圖仍在底層；無法證明點選 handler、Map camera 持續性 |

### 實際操作紀錄

| 步驟 | 預期 | 觀察／證據 |
| --- | --- | --- |
| Web 搜尋「南屯素食館」→ 點第一項 → 返回 → 最近搜尋重進 | Home↔Detail 與搜尋歷史 | 實際成功；[Web Detail](web-before-place-light.png)、[Web Home](web-before-home-light.png) |
| iOS `simctl launch` → `openurl .../place/google%3AChIJSY-O5b09aTQR8I0ZFEuU4DA` | 開啟正式 Detail，Map 不卸載 | 實際顯示南屯素食館與底層地圖；[最後版](ios-final-detail.png)。此為深連結，**不是點擊** |
| iOS `simctl ui content_size accessibility-extra-extra-extra-large` → 重開同地點 | 主資訊仍可讀 | **FAIL**：peek 下緣裁切；[畫面](ios-final-detail-axxxl.png)。已恢復標準字級 |
| iOS 搜尋／drag／收藏／分享／外鏈 | 各 handler 與系統互動正常 | **未驗證**：環境無 GUI 觸控 driver |
