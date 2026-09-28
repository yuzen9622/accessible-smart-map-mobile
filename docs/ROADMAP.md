# 分期實作計畫（Roadmap）


| 項目     | 內容                                                                                                   |
| -------- | ------------------------------------------------------------------------------------------------------ |
| 版本     | v0.4（草案）                                                                                           |
| 日期     | 2026-09-28                                                                                             |
| 設計依據 | [`SDD.md`](./SDD.md)（v0.4，納入 Lucide icon 全局設計決策）                                             |
| 估時前提 | 1 名熟悉 Web 版程式碼的全職工程師；時程為依程式規模推估，**未經驗證**，Phase 0 spike 結果出來後要重估     |


## 總覽


| 期   | 主題                                             | 估時    | 累計   | 可交付                      | 後端相依                |
| --- | ---------------------------------------------- | ----- | ---- | ------------------------ | ------------------- |
| 0   | 基礎建設＋技術 spike                                  | 2–3 週 | 3 週  | dev build、共用層、spike 結論   | 提出 B-01～B-08        |
| 1   | 地圖核心＋地點                                        | 3–4 週 | 7 週  | TestFlight／Play 內測 α     | B-01、B-07           |
| 2   | 路線＋導航＋公車                                       | 4–6 週 | 13 週 | 內測 β（核心價值）               | —                   |
| 3   | 帳號、SOS、通報、推播                                   | 3–4 週 | 17 週 | 功能對齊 Web（除 AI）           | B-02、B-03、B-04、B-08 |
| 4   | AI 聊天＋語音                                       | 3–5 週 | 22 週 | 功能完整                     | —                   |
| 5   | 無障礙稽核＋上架（**暫緩**：上架需 Apple Developer 年費，先規劃不執行） | 2–3 週 | 25 週 | App Store／Google Play 上架 | —                   |


每期結束都必須是可安裝、可使用的狀態；不留半套功能在主分支上（未完成的功能放在 feature flag 後）。

> **未繳 Apple Developer 年費期間**（SDD R9）：各期「送 TestFlight／Play 內測」改為「iOS 模擬器＋Android 真機（側載 APK）可安裝」。需要真機的驗證（語音、背景定位）先在 Android 真機做；Sign in with Apple、iOS 推播在免費帳號無法真機驗證，集中到繳費後補做。

---

## Phase 0 — 基礎建設與技術 spike（2–3 週）

**目標**：開發流程可運作；兩個最大技術風險（R1 語音、R2 地圖）有結論；後端變更已排入。

### 步驟

**0.1 工程基礎**

- [x] 第一個 commit：現有骨架＋`docs/`
- [x] 切到 dev build 工作流程：`npx expo install expo-dev-client`，`LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 npx expo run:ios` 能啟動（2026-09-25 iOS 27 模擬器實跑）
- [ ] Android 模擬器 `npx expo run:android` 能啟動（使用者決定 Phase 0 先跳過：本機沒有 emulator 映像且磁碟空間不足）
- [x] 建立 `eas.json`（development／development-device／preview／production profile）
- [x] `eas build --profile development` 一次：2026-09-28 iOS（simulator）成功，專案 `@yuzen/accessible-smart-map-mobile`，build `18e4e57d-73f3-437b-8999-dc9adc8c98e7`。修正：`plugins/with-ios-scene-lifecycle.ts` 要 import `expo/config-plugins.js`（eas-cli 用 Node 原生 ESM 載入 TS plugin）
- [x] 導入 `jest-expo` 與 `@testing-library/react-native`，加 `npm test` 腳本（`jest.config.js`；TS 6 需在 `tsconfig` 寫 `types: ["jest"]`）
- [x] CI（GitHub Actions）：typecheck + lint + test（`.github/workflows/ci.yml`，推上 GitHub 後才會實際跑）
- [x] 建立 `docs/port-ledger.md`（SDD §13 格式）

**0.2 共用層（`src/shared/`）**

- [x] `shared/config`：`EXPO_PUBLIC_*` 驗證＋設定錯誤畫面（iOS `ContentUnavailableView`）；值放 `.env`
- [x] `shared/api`：移植 Web `src/lib/fetch.ts`（`fetchRequest`／`authenticatedRequest`／`ApiError`，401-retry-once、403 立即失效、`skipAuthRetry`）與 `ApiResponse<T>` 型別；先接上 stub `AuthPort`
- [x] `shared/api/sse.ts`：`expo/fetch` `ReadableStream` SSE parser＋單元測試（切事件、多行 data、斷線、Abort）
- [x] `shared/storage`：MMKV 實例、SecureStore 包裝、zustand persist adapter、schema version migration 工具（取代 Web 13 個用到 localStorage 的檔案，對照見 SDD §7.3）
- [x] `shared/i18n`：i18next + `expo-localization`，搬入 Web `src/i18n/locale/{zh-TW,en}/translation.json`；移除 `[lng]` 路由與 middleware 的等價物（App 內自選語系留待 settings）
- [x] `shared/theme`：擴充既有 theme：淺／深／高對比 token、字級倍率
- [x] `shared/location`：`LocationPort` 介面＋前景實作
- [x] `shared/ui`：Button、EmptyState、ErrorState、LoadingState（含無障礙屬性；iOS 用 `@expo/ui`）。導入 `lucide-react-native` + `react-native-svg` 作為全 App 統一圖示系統（取代 SF / Material Symbols）。Toast 延到 Phase 1 有實際使用處時再定（iOS 無系統 toast，需選型）

**0.3 Spike A — 地圖（R2）**

- [x] 安裝 `@maplibre/maplibre-react-native`（11.4.0，peer 已核實相容 SDK 57／RN 0.86 New Arch），載入 Web 版 liberty／dark style
- [x] 載入 `all-facilities`（實測 5,836 點、1.1 MB），用 `GeoJSONSource cluster` + `SymbolLayer` 顯示，量測 FPS 與記憶體
- [x] 驗證 `fill-extrusion` 3D 建物，以及 2D/3D 透明度交叉淡化可行性
- [x] 驗證 `Camera.flyTo`、`fitBounds`、padding（sheet 遮擋時的地圖 inset）
- [x] 產出：`docs/spikes/map.md`（可行／不可行、數據、決定）

**0.4 Spike B — 語音（R1）**

- [ ] 閱讀後端 `docs/specs/VOICE_WS_PROTOCOL.md` 全文（Phase 4 開頭連線前做；Spike B 只依 SDD §6.7 摘要的格式驗證）
- [x] 兩個候選各做一次 16 kHz mono 擷取：`expo-audio` `useAudioStream`（官方，先試）與 `react-native-audio-api` `AudioRecorder.onAudioReady`；確認資料格式（兩者文件皆為 Float32）與實際取樣率
- [ ] 確認重取樣具抗混疊（原始碼已確認 iOS 用 `AVAudioConverter` 最高品質、Android 用 miniaudio 線性＋低通；頻譜實測需真機）（44.1 kHz／48 kHz 裝置錄音後頻譜檢查，或用已知頻率測試音）
- [x] 24 kHz PCM16 佇列播放、打斷清空
- [ ] 連後端 `wss://.../api/v1/voice/ws` 完成一次真機對話（`session.start` 需登入 token，移到 Phase 4 開頭）
- [x] 產出：`docs/spikes/voice.md`；不可行則啟動備案（自寫 Expo native module）並重估 Phase 4

- 註：模擬器麥克風不可靠，擷取品質要真機驗證；iOS 免費帳號可裝到自己的 iPhone（7 天簽章），或先用 Android 真機

**0.4b Spike C — 原生 sheet 與玻璃效果（ADR-05、ADR-15）**

- [x] 地圖畫面上以 Expo Router `formSheet`（`sheetAllowedDetents`、`sheetLargestUndimmedDetentIndex`）做常駐 sheet：低 detent 時地圖可拖曳、可禁止下滑關閉、sheet 內 push／back 正常
- [x] 確認 iOS 26+ sheet 背景是否自動套 Liquid Glass；浮動按鈕用 `@expo/ui` `Button` glass style＋`GlassEffectContainer`
- [x] ~~不可行時試 `@expo/ui` `BottomSheet`~~（formSheet 已可行，不需要） + `presentationDetents` + `presentationBackgroundInteraction`；Android 行為不足則評估 `@gorhom/bottom-sheet`
- [x] 產出：`docs/spikes/sheet.md`

**0.5 後端與決策**

- [x] 把 SDD §8 的 B-01～B-08 開成後端 issue（accessible-smart-map-backend #17–#24），時程待後端排定
- [x] 回答 SDD §14 的 Q1、Q2：沿用 `com.accessiblemap.app`（Capacitor 版未上架、將棄用）；正式 API `https://map.yuzen.dev`
- [x] B-01（refresh 不只靠 cookie）、B-02（Google audience 接受 iOS／Android）、B-03（Apple 登入）：使用者已決定會向後端提出

### 出口條件

- dev build 在 iOS 模擬器與 Android 模擬器都能跑；CI 全綠
- 三份 spike 報告（地圖、語音、sheet）有明確結論；Phase 1–5 估時已依結果更新
- B-01 已排入後端且有預計完成日

---

## Phase 1 — 地圖核心與地點（3–4 週）

**目標**：打開 App 就能在地圖上看到無障礙設施、搜尋地點、看詳情與評論。

### 步驟

**1.1 主畫面骨架**

- [x] `src/app/_layout.tsx`：Theme、i18n、config 檢查、常駐 formSheet（Toast 仍待選型）
- [x] `features/map`：`MapScreen`、`mapCamera`（MapController port；每個動作帶入 sheet inset）。SheetController 由 Expo Router 路由直接擔任；`MapControls` 浮動按鈕（定位 `LocateFixed`、2D/3D `Box`／`Layers`）以 Lucide icons 實作
- [x] `MapSheet`：`(sheet)` formSheet stack（peek 15%／half／full）；點地圖或設施時詳情頁用 replace，不會一路疊
- [x] 地圖 padding 隨 sheet detent 更新（`sheetDetentChange` 事件 → `mapUiStore.sheetInset`）

**1.2 地圖圖層**

- [x] 底圖主題跟隨系統；地圖標籤跟隨語系（移植 `applyMapLanguage`，改寫 style JSON）
- [x] 2D/3D 切換（透明度淡化＋pitch，偏好存 MMKV）
- [x] FacilityLayer（原生 cluster，MMKV 快取 24h）＋設施詳情 sheet
- [x] ParkingLayer（移動 ≥100 m 才重查，移植 `useFetchLocation`）
- [x] 使用者位置 puck＋heading；GPS 錯誤只在進入錯誤狀態時播報（移植 `gpsErrorHandler.ts` 與其測試）
- [x] 定位權限流程：onboarding 說明頁 → 系統彈窗 → 結果以文字播報（「前往設定」捷徑待 settings）
- [x] 「附近設施清單」列表視圖（`/nearby`，含類別開關）

**1.3 place**

- [x] 移植 `lib/place/{adapters,lang,searchSession}.ts`、`formatNominatimPlace` 與測試
- [x] 搜尋：autocomplete、搜尋紀錄、結果 pin
- [x] 地點詳情：無障礙屬性（三態）、分享（iOS `ShareLink`；RN `Share` 在常駐 formSheet 上不會出現）、複製
- [x] 評論：列表、AI 摘要（唯讀；模擬器尚未看到有評論的地點）
- [x] 收藏地點＋自訂分類（MMKV persist，`commitVersionedWrite` 遷移）
- [x] 點地圖反查地址 → 地點 sheet
- [x] 深層連結 `loc/<lat>,<lng>`（模擬器驗證）、`place/<id>`（路由已建，未實測）

**1.4 onboarding（精簡版）**

- [x] Intro／Needs／Location／Done 四步；需求輪廓存本機，完成時套用預設設施類別

### 出口條件

- 7.9k 設施點互動流暢（依 spike A 基準）
- 搜尋 → 詳情 → 分享 → 由分享連結重開的流程可在模擬器完成
- 移植的 place 測試全綠；port-ledger 已登錄
- α 版可安裝在 iOS 模擬器與 Android 真機（TestFlight 待繳費）

---

## Phase 2 — 路線、導航、公車（4–6 週）

**目標**：完成核心價值「規劃無障礙路線並跟著走」，含背景導航。

### 步驟

**2.1 route**

- [ ] 移植 `src/types/route.ts`、`lib/geo.ts`、`lib/route/routeSession.ts`、`lib/routePreviewAdapter.ts` 與測試（`routeSession`、`geo-incidents`、`route-traffic`）
- [ ] `RouteSessionPort`：`computeRoute`、`endRouteSession`（清除清單含 origin／destination）、`hasRouteSession`、`shouldShowRoutePill`
- [ ] 起訖點輸入、模式切換（步行／大眾運輸／開車）、無障礙偏好
- [ ] 路線卡列表、排序、無障礙亮點；leg 詳情（步行步驟、大眾運輸站點、開車步驟、事故提示、步行無障礙摘要；運具 leg 圖示統一為 Lucide icons：`Accessibility`、`Bus`、`TrainFront`、`Car`）——各面板的原生元件對應見 SDD §4.5 表格
- [ ] RouteLayer：分段 polyline（per-leg `polylineIndex` + `legIndex`）
- [ ] RouteSessionPill：切到其他功能後可回到路線
- [ ] 路線文字步驟視圖（無障礙替代路徑）

**2.2 bus**

- [ ] 移植 `lib/transit/{busLegStops,busRouteDetailCache}.ts` 與測試；補「365／26 反向、70 不反」與「整段同一狀態文字」的測試案例
- [ ] leg 站點 ETA（`useBusLegStopEtas`）、即時公車位置（輪詢＋內插，AppState 感知）
- [ ] 公車面板：附近站牌、路線／站牌搜尋、路線詳情（依方向）
- [ ] 交通警示（`/transit/alerts`）

**2.3 navigation**

- [ ] 移植 `lib/navigation/*` 與測試（`advisorySpeech`、`foregroundLocation`、`legMode`、`navigationAudio`、`rerouteCoordinator`、`navigationTakeoverGeometry`、`useRouteReroute`）
- [ ] 把 Web `useNavigation.ts` 拆成 `domain/navigationEngine.ts`（純函式）＋ `NavigationController`＋薄 hook，並為 engine 寫測試
- [ ] NavigationHUD（轉向圖示、距離、進度、leg 交接卡）、步驟清單、離開確認、重算遮罩——版面依 SDD §4.5「導航 HUD」（`GlassView` 卡片＋Lucide icons，移植 Web 版 `navStepIcon` 轉向圖示系統）
- [ ] 偏航偵測＋`/accessible-route/reroute`＋冷卻
- [ ] `expo-speech` 播報（喇叭仲裁規則）、`expo-haptics`、`expo-keep-awake`
- [ ] **背景定位**：`expo-task-manager` 任務、iOS `UIBackgroundModes: location`、Android foreground service 通知；只在導航進行中啟用
- [ ] **鎖定畫面導航與即時動態（Live Activities & Ongoing Notification）**：
  - `plugins/with-live-activity.ts`：Config Plugin 配置 iOS Widget Extension target、`NSSupportsLiveActivities: true`、SwiftUI 檔案連結
  - iOS 原生端：Swift 定義 `NavigationActivityAttributes`、SwiftUI 實作鎖定畫面卡片與動態島（Compact、Expanded、Minimal）
  - Android 原生端：前景服務整合 `CATEGORY_NAVIGATION`、`VISIBILITY_PUBLIC` 常駐通知，支援自訂版面與結束導航動作
  - `LiveNavigationPort` 與 TS 介面封裝（`start`、`update`、`end`），串接 `navigationEngine` 狀態，加入更新節流機制（每 2 秒或距離變更 ≥10m）
- [ ] 抵達偵測（只設定一次）

### 出口條件

- 模擬器以 GPX 模擬 WALK→MRT→WALK、WALK→BUS→WALK、DRIVE 三型路線全程導航正確，含 leg 交接
- 鎖螢幕 5 分鐘後仍持續播報與更新進度（真機驗證；未繳費前先用 Android 真機）
- 鎖定畫面與動態島（iOS Live Activity、Android 常駐通知）正確顯示下一步轉向與距離，隨 GPX 移動即時更新；抵達或結束時立即清除（iOS 模擬器可完整驗證，未繳費期間不阻礙開發）
- 公車 365、26、70 的站點方向與 ETA 正確
- 移植測試全綠；送內測 β

---

## Phase 3 — 帳號、SOS、通報、推播（3–4 週）

**前置**：後端 B-01（Phase 1 應已完成）、B-02、B-03、B-04、B-08。

### 步驟

**3.1 auth**

- [ ] 逐行移植 `lib/authRefresh.ts`、`lib/authTransport.ts`、`lib/passwordValidation.ts` 與測試（`authRefresh`、`resetPassword`、`passwordValidation`、`useAuthStore`）
- [ ] 真正的 `AuthPort` 實作（取代 Phase 0 stub）；token 存 SecureStore；冷啟動靜默續期
- [ ] Email 註冊／登入／重寄驗證信／忘記密碼（寄信）；**驗證與重設密碼頁留在 Web**，信件連結開瀏覽器
- [ ] Google 登入（`@react-native-google-signin/google-signin`）
- [ ] Apple 登入（`expo-apple-authentication`，僅 iOS）
- [ ] 帳號安全（改密碼，`skipAuthRetry: true`）、LINE 綁定碼、登出、刪除帳號（上架要求，依後端 B-08）
- [ ] 需求輪廓同步 `GET|PUT /user/a11y-profile`
- [ ] 撰寫／編輯／刪除評論（Phase 1 延後的部分）

**3.2 sos**

- [ ] 移植 `lib/sosSession.ts`、`useSosLifecycle` 策略（snapshot → SSE → 重試 3 次 → 8 秒輪詢）並**補寫 lifecycle 測試**
- [ ] SOS 流程畫面（防誤觸確認、大型觸控目標、震動）、處理歷程、分享追蹤連結（`shareToken`）
- [ ] 緊急聯絡人管理（上限 5 人）
- [ ] 重啟後復原（12h 內；伺服器為準；只檢查一次）
- [ ] SOS 期間背景位置上傳
- [ ] SosTrackerLayer＋導航前往求助者（對齊 Web 版：一鍵直達、預設開車；求助者靜止時不自動重算）

**3.3 hazard**

- [ ] 通報流程：類型、嚴重度、`expo-image-picker` 拍照／相簿、壓縮、`FormData` 上傳
- [ ] HazardLayer、附近通報、確認他人通報、我的通報

**3.4 推播**

- [ ] `expo-notifications`：權限請求時機（第一次 SOS 或設定頁，不在冷啟動就問）、註冊 token 到 B-04 端點、登出時註銷
- [ ] 處理 SOS 狀態變更推播（點擊開啟 SOS 畫面）

**3.5 settings**

- [ ] 設定首頁與子頁（`@expo/ui`）：主題、高對比、字級、語系、AI 記憶（佔位）、資料管理

### 出口條件

- 並發 10 個過期請求只觸發 1 次 refresh（測試）；logout→relogin race 測試通過
- Google／Apple／Email 三種登入成功（Apple 登入與 iOS 推播需付費帳號才能真機驗證）
- SOS：發起 → 殺 App → 重開復原；背景時收到狀態推播
- iPhone HEIC 照片通報成功

---

## Phase 4 — AI 聊天與語音（3–5 週，依 spike B 結論調整）

### 步驟

**4.1 AI 聊天**

- [ ] 移植 `lib/ai/{thinkingTrace,streamingText,toolLabels,toolActionMapper,uiAction,orbState}.ts`、`lib/aiResults.ts`、`lib/toolResultCards.ts` 與測試（`streamingText`、`thinkingTrace`、`toolResultCards`）
- [ ] `actionExecutor` 改走 `MapController`／`SheetController`／`RouteSessionPort`；以 `AuthPort` 切斷 Web 的 import cycle
- [ ] Markdown 渲染小 spike（JS 渲染器 vs `'use dom'`，判準見 SDD §6.6）
- [ ] 聊天 modal：串流訊息、markdown、ThinkingTrace（主案 RN＋Lucide icons（`Sparkles`、`Loader2`、`Check`）＋`GlassView`，備案 `DisclosureGroup`，見 SDD §6.6）、快速動作、取消
- [ ] **async action（`compute-route`）在聊天路徑 await 並回報結果**
- [ ] AI 記憶管理頁（`/ai/memories`、`/ai/memories/settings`）
- [ ] AI 路線說明（`/ai/explain`）接進路線面板

**4.2 語音**

- [ ] 近原樣移植 `lib/voice/voiceSession.ts`、`voiceSessionBindings.ts`、`transcriptAggregator.ts`、`audioLevel.ts`、`navProgress.ts`、`voiceNavigationExit.ts` 與測試（9 個）
- [ ] `AudioCapturePort`／`AudioPlaybackPort` 原生實作（依 spike B）；iOS audio session `playAndRecord` + `voiceChat`
- [ ] `WebSocket`（`binaryType = "arraybuffer"`）transport port
- [ ] 語音模式 UI：浮動指示器、音量、逐字稿、工具呼叫狀態
- [ ] **async action（`compute-route`）在語音路徑各自接線**
- [ ] 語音導航交接（`NavigationPort.adoptVoiceNavigation`）、斷線重連＋`nav.resume`（只在重連時送）
- [ ] 與本機 TTS 的喇叭仲裁

### 出口條件

- 聊天與語音各自說「規劃到台北車站的無障礙路線」，路線面板都正常顯示、不卡轉圈
- 真機連續語音對話 5 分鐘無爆音／變調；打斷立即停；斷 Wi-Fi 再恢復可接回語音導航
- 移植的 voice／ai 測試全綠

---

## Phase 5 — 無障礙稽核與上架（2–3 週，暫緩）

> 使用者決定先暫緩：上架需 Apple Developer Program 年費與 Google Play 開發者註冊費。5.1 無障礙稽核中不需真機的項目（Dynamic Type、對比、觸控目標）可提前在各期順手做。

### 步驟

**5.1 無障礙稽核（依 SDD §10 逐項）**

- [ ] VoiceOver（iOS 真機）、TalkBack（Android 真機）各走完主流程：搜尋 → 路線 → 導航 → SOS → 通報 → 聊天
- [ ] Dynamic Type 最大級距、高對比、減少動態效果、觸控目標尺寸檢查
- [ ] 修正清單歸零（或列為已知問題並有時程）

**5.2 品質**

- [ ] 效能：冷啟動時間、地圖 FPS、記憶體（長時間導航）
- [ ] 錯誤回報（例如 Sentry）與基本分析；隱私權政策同步更新
- [ ] 離線與弱網路行為檢查

**5.3 上架準備**

- [ ] App 圖示、啟動畫面、商店截圖（中英）、描述、分類
- [ ] 權限用途說明文字最終版；背景定位審查備註（說明只在導航／SOS 時使用）與 Google Play 背景位置聲明表與示範影片
- [ ] iOS Privacy Manifest、App Privacy 問卷、Play Data safety
- [ ] 帳號刪除功能（App Store 要求）
- [ ] （v1.x 候選）Universal Links／App Links 只用於分享連結；email 驗證／重設密碼維持開 Web
- [ ] `eas build --profile production`、`eas submit`；設定 EAS Update channel

### 出口條件

- 兩家商店審核通過並上架
- EAS Update 可推送 OTA 修正

---

## 上架後（v1.x 候選）

- 收藏地點雲端同步（需後端 API）
- 平板／橫向版面
- iOS Live Activity／Android 持續通知顯示導航進度
- 語音助理背景模式
- 評估移除 Web repo 的 Capacitor 設定

---

## 每期共同的完成定義（Definition of Done）

1. `npm run typecheck`、`npm run lint`、`npm test` 零錯誤零警告。
2. iOS 模擬器實跑驗證，並附截圖或錄影；語音、背景、推播、螢幕閱讀器需真機驗證。
3. 移植的模組已登錄 `docs/port-ledger.md`（來源路徑＋commit）。
4. SDD 中該 feature 的「必守不變量」都有對應測試或驗證紀錄。
5. 新增的權限、plugin、環境變數已寫進 `app.json`／`eas.json`／README。

