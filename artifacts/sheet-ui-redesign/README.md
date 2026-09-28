ACCEPTANCE: PARTIAL — V11 FAIL（AX XXXL peek 裁切）；V1–V7/V9/V10 的觸控、detent、鍵盤與 body 驗收 NOT VERIFIED（無 Simulator.app GUI driver）；機械項 #10 FAIL（範圍外既有 SavedPlacesPanel systemImage）

# Sheet UI redesign（Explore／PlaceDetail）— 截圖與驗收紀錄

計畫：`.pi/plans/sheet-ui-redesign.md`（Rev.4）。本檔是計畫指定的驗收紀錄；`acceptance.md` 為同一結論的摘要。

## 環境

| 項目 | 值 |
|---|---|
| 裝置 | iPhone 18 Pro 模擬器，iOS 27.0，UDID `1539044C-E6E6-442A-AF9D-69783919FF0D` |
| Xcode | `/Applications/Xcode.app/Contents/Developer`；`Contents/Developer/Applications/` 無 `Simulator.app`（`ls` 為空）→ 無 GUI 觸控／拖曳／鍵盤／VoiceOver |
| 驅動手段 | `xcrun simctl launch/terminate/openurl/io screenshot/ui appearance/ui content_size`、`log show` |
| Web 基準 | agent-browser session `sheet-redesign-5967804c1fc4`（見 `browser-session.txt`），`https://map.yuzen.dev/zh-TW/`，390×844 淺色 |
| Build | `npx expo run:ios --device "iPhone 18 Pro"`：Build Succeeded，0 error、2 warning（Xcode run-script「Based on dependency analysis」提示）；Metro log `/tmp/sheet-ui-metro.log` |

基準地點：南屯素食館 `google:ChIJSY-O5b09aTQR8I0ZFEuU4DA`；iOS deep link `accessiblesmartmap://place/google%3AChIJSY-O5b09aTQR8I0ZFEuU4DA`；Web 為搜尋選取。

## 截圖清單

| 檔案 | 時間（2026-09-28, CST） | 平台 | 狀態 | 類別 |
|---|---|---|---|---|
| `web-before-home-light.png` | 既有 | Web | 首頁（搜尋歷史下拉展開） | Web 實機基準 ✅（已開圖核對） |
| `web-before-place-light.png` | 既有 | Web | 南屯素食館詳情 | Web 實機基準 ✅（已開圖核對） |
| `web-before-home*.png`、`web-before-search.png`、`web-before-place*.png` | 既有 | Web | 輔助 | 輔助佐證 |
| `ios-before-home.png` | 既有 | iOS | 首頁 half，灰底 SwiftUI Form | iOS before ✅ |
| `ios-before-home-peek.png` | 22:29 | iOS | 冷啟動後 peek：搜尋框 + 捷徑第一列露出 | iOS before（本次補拍） |
| `ios-before-detail-real.png` | 既有 | iOS | 南屯素食館 half，CTA「規劃路線」 | iOS before ✅ |
| `ios-before-detail.png` | 既有 | iOS | id 無前綴、依設計載入失敗 | **非**詳情基準 |
| `reference-home.png`、`reference-detail.png` | 既有 | — | 設計參考稿 | **非** Web 實機基準 |
| `ios-after-place-v1-header-under-navbar.png` | 22:51 | iOS | 詳情 half（該次 deep link 自然落在 half），**修正前**：標頭被透明導覽列蓋住 | after（中間版本，保留作為 bug 證據與 body 版面佐證） |
| `ios-after-home-peek.png` | 22:59 | iOS | 冷啟動 peek | after（最終程式） |
| `ios-after-place.png` | 23:00 | iOS | 詳情，觀察到的 detent：**peek**（只露標頭） | after（最終程式） |
| `ios-after-place-dark.png` | 23:00 | iOS | 同上，`appearance dark` | after（最終程式） |
| `ios-after-place-a11y-xxxl.png` | 23:00 | iOS | 同上，`content_size accessibility-extra-extra-extra-large` | after（最終程式） |
| `ios-after-home-explore-link.png` | 23:00 | iOS | `openurl accessiblesmartmap://explore` 回首頁（peek） | after（最終程式） |
| `ios-after-home-peek-a11y-xxxl.png` | 23:00 | iOS | 首頁 peek，最大字級 | after（第一次實作） |
| `ios-final-detail.png` | 23:25 | iOS | 修正對比／Dynamic Type 後的同地點 peek | **最後程式版本**，已開圖 |
| `ios-final-detail-axxxl.png` | 23:25 | iOS | 最後程式版本、AX XXXL 的 Detail peek | **最後程式版本**，已開圖；下緣裁切（V11 FAIL） |

未擷取（需拖曳 detent／點擊收藏，無 GUI）：`ios-after-home-half.png`、`ios-after-home-full.png`、`ios-after-home-half-with-saved.png`。未以暫改程式、假收藏等方式偽造。

最後一次視覺修改為對比度與大字級動作列修正；已用正式 dev build／Metro 重新開啟相同地點，查看 `ios-final-detail*.png`。最後截圖後僅移除一處尾端空白；無法拖至 half/full，動作列修正僅有程式與型別證據，**不可宣稱畫面已驗證**。

## 實作重點（對照截圖觀察）

- Explore peek：搜尋列（Lucide `Search`）為第一列，無品牌列；下方「你附近」橫向卡片（Lucide `ArrowUpDown` 電梯）→ R1（react-native-svg 在 formSheet 內渲染）未發生。
- PlaceDetail：`地點資訊` 小標 + 標題 + 地址；badges「餐廳」「無障礙資訊未確認」+「在 Google 地圖查看」（此地點 `externalLinks.osm` 為空，只有 Google）；主要 pill「重新置中」（無「規劃路線」）；Lucide 書籤／分享／複製；地址兩欄卡；附近無障礙設施（空狀態文案）；清單 2×2（`?` 圖示 + 未確認）。
- 分享：**路線 A** 成立——`ShareLink` label 內 `RNHostView matchContents` 嵌入 Lucide `Share2`，截圖可見圖示與「分享」文字；未退回路線 B。
- 修正的視覺 bug：sheet 內 Stack 為 `headerTransparent`，RN `ScrollView` 預設不避讓 → 標頭被導覽列蓋住（v1 截圖）。加 `contentInsetAdjustmentBehavior="automatic"` 並把 `paddingTop` 12 → 20 後，小標完整露出（最終截圖）。
- R7 bundle：barrel import 使 iOS bundle +2,317,881 bytes（> 300 KB）；改為 `lucide-react-native/icons/*` deep import 後 +225,674 bytes（3,420,540 → 3,646,214，含 react-native-svg）。

## V9 對比（WCAG，半透明色塊先疊到背景再算）

| 組合 | light | dark（修正前） | dark（修正後） |
|---|---|---|---|
| OK 文字 / OK_SURFACE | 4.59 | 3.63（`#1B7F3B`） | 9.59（`#4CD471`） |
| WARN 文字 / WARN_SURFACE | 4.71 | 3.53（`#B25000`） | 8.95（`#FF9F2E`） |
| NO 文字 / NO_SURFACE | 5.14 | 3.18（`#C02020`） | 6.82（`#FF6961`） |
| text / SURFACE | 18.27 | 19.29 | — |
| textSecondary / SURFACE | 5.17 | 9.26 | — |
| ACCENT `#0065C8` / 白底及白字 / ACCENT | **5.68** | — | — |
| 深色 accent 文字 `#6BB2FF` / 黑底 | — | — | **9.44** |

深色 tri-state 使用 `*_DARK`；本次也將 `palette.ts` 的 feature 專屬 accent 從 `#0A84FF` 改為 `#0065C8`，讓淺色小字與白字主按鈕皆達 AA；深色文字／圖示使用 `#6BB2FF`。上述為獨立 WCAG 公式檢查，非最終卡片像素證據。

## 執行期驗證

| # | 狀態 | 證據／說明 |
|---|---|---|
| V1 | 部分 PASS；detent 切換 NOT VERIFIED — no GUI driver | 兩面板 JSX 根節點皆單一 `<ScrollView`（code review）；`grep -c subviews /tmp/sheet-ui-metro.log` = 0；`log show --last 15m --predicate 'eventMessage CONTAINS "subviews"'` 無 app 訊息。涵蓋 peek home、deep-link place（peek 與 half 各一次） |
| V2 | 截圖 PASS；聚焦 NOT VERIFIED — no GUI driver | `ios-after-home-peek.png`：搜尋列第一列、完整可見、無品牌列 |
| V3 | NOT VERIFIED — no GUI driver | 需拖曳到 half/full、點收藏 |
| V4 | NOT VERIFIED — no GUI driver | |
| V5 | NOT VERIFIED — no GUI driver | `openurl …/explore` 可回首頁（非點擊驗證） |
| V6 | NOT VERIFIED — no GUI driver | |
| V7 | NOT VERIFIED — no GUI driver | v1 截圖可見 badges 之後接「在 Google 地圖查看」；此地點無 OSM 連結，OSM→Google 實機順序無法觀察（程式順序由機械項 #9 證明）；點擊未驗 |
| V8 | 部分 PASS（標頭可到達） | `ios-final-detail.png` 可見最新標頭；分享圖示與 body 僅見修正前 v1 half 圖，**最終版 body 未驗證** |
| V9 | NOT VERIFIED — no GUI driver（卡片） | `ios-after-place-dark.png` peek 只露標頭，可讀；卡片／chip 未到達。對比計算見上表 |
| V10 | NOT VERIFIED — no GUI driver | |
| V11 | **FAIL（AX XXXL peek）**；half/full NOT VERIFIED | `ios-final-detail-axxxl.png`：固定 0.15 detent 下大字標題／地址被 sheet 下緣明顯裁切。已把大字時的主要 CTA 改獨佔一列、ShareLink 改語意 body 字級，但無法拖曳驗證。Lucide 圖示仍為固定尺寸 |
| V12 | PASS（可到達畫面） | 首頁 peek、詳情 peek、v1 half：無麥克風、篩選、頭像、規劃路線入口、編輯、回報／公車／停車 chips、回報連結、登入卡 |

## 機械驗收

| # | 結果 | 關鍵輸出 |
|---|---|---|
| 1 | PASS | `npx expo install --check` → Dependencies are up to date；react-native-svg 15.15.4 |
| 2 | PASS | `npm run typecheck` exit 0 |
| 3 | PASS | `npx expo lint` 無輸出（0 error／0 warning） |
| 4 | PASS | 34 suites／188 tests；`placeBadges.test.ts`、`nearbyFacilityRows.test.ts`（含畸形資料）、`i18n.test.ts` PASS |
| 5 | PASS | `npx expo-doctor` 21/21 checks passed |
| 6 | PASS | `:244 onPlanRoute: handlePlanRoute`、`:256 onRecenter: handlePlanRoute`、`:239 planRouteLabel: t('planRoute')` |
| 7 | PASS | 無輸出 |
| 8 | PASS | 無 `-` 行 |
| 9 | PASS | `viewOnOSM` :208 < `viewOnGoogleMaps` :212 |
| 10 | **FAIL** | 本次檔案（ExplorePanel／PlaceDetailView／ShareButton*）無命中；命中僅 `SavedPlacesPanel.tsx:4,18`、`SavedPlacesPanel.android.tsx:4,18`（既有 `EmptyState systemImage="bookmark"`，不在計畫修改範圍，未動） |
| 11 | PASS | 只有 `src/shared/ui/Icon.tsx` 匯入 lucide-react-native |
| 12 | PASS | 兩檔各 1 行 `<Icon`；`RNHostView` 計數 4（路線 A） |
| 13 | PASS | 4 |
| 14 | PASS | 無輸出（`ios/`、`android/` 為 gitignore 的 CNG 產物） |
| 15 | PASS | `hooks/useNearbyViewModel.ts`、`index.ts` |
| 16 | PASS | 無輸出 |
| 17 | PASS | ` M README.md`——開始前即存在（步驟 0 已記錄），本次未觸碰 Web repo |
| 18 | PASS | 無 MISSING |
| 19 | PARTIAL | 本檔第一行 |
| 20 | PASS | Build Succeeded 並在 iPhone 18 Pro 啟動 |

## 未驗證／風險

- Android 未建置、未執行。sheet 內 Stack 在 Android 同樣 `headerTransparent`，`contentInsetAdjustmentBehavior` 只作用於 iOS，Android 詳情標頭可能被導覽列蓋住（舊 Android 版同樣沒有避讓，非本次新增，但未驗證）。
- iOS 分享按鈕點圖示／文字是否都觸發系統分享單、是否被 sheet 擋住：未驗證（V6）。
- AX XXXL 在固定 peek detent 下標題／地址被下緣裁切（`ios-final-detail-axxxl.png`）；不是已解決狀態。大字級動作列的實際佈局也尚未驗證（V11）。
- `showBrand` 依賴 `sheetDetentChange` 更新 `sheetInset`；peek 時確認為 false（截圖），half/full 時為 true 未實機觀察（V3）。
- 新增原生相依 `react-native-svg`：既有 dev client／EAS build 不能跑新 bundle，不可用 `eas update` 推到既有 runtime。
