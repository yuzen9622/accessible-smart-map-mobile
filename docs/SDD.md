# 臺北無障礙導航 App — 軟體設計文件（SDD）

| 項目 | 內容 |
|---|---|
| 版本 | v0.2（草案） |
| 日期 | 2026-09-25 |
| 狀態 | 待審閱；§8 後端變更與 §14 未決問題需決策。v0.2：納入使用者決策（原生 UI 優先、email 頁留 web、五期分工）與 Phase 0 套件核實結果 |
| 參考系統 | Web 版 `/Users/yuen/orca/taipei-accessible-map`（Next.js 16，移植基準 commit `5eadc71`）、後端 `/Users/yuen/project/taipei-accessible-backend` |
| 分期執行 | 見 [`ROADMAP.md`](./ROADMAP.md) |

> 本文件中「Web `src/...`」指參考專案路徑；「後端 `src/...`」指後端 repo 路徑；未加前綴者為本 repo。
> 標 **〔未核實〕** 的項目在 Phase 0 spike 前不得當作事實依賴。

---

## 1. 目的與範圍

### 1.1 目標

1. 以 Expo（SDK 57）原生復刻 Web 版全部使用者功能，功能對齊、UI 改用 iOS／Android 原生慣例。
2. 取得 WebView 做不到的能力：背景定位導航、原生地圖效能、原生語音串流、推播、完整 VoiceOver／TalkBack 語意。
3. 移植並保留 Web 版在邏輯層累積的不變量與已修 bug（§6 每個 feature 的「必守不變量」）。

### 1.2 非目標

- 不做 Web 版的桌機 rail 版面（`useIsDesktop` 分支）、鍵盤快捷鍵（`KeyboardShortcuts.tsx`）。
- 不做 LINE webhook／LIFF 端；LINE 綁定只保留「產生綁定碼」。
- 不在本 repo 做 web 輸出（`react-native-web` 僅為 Expo 預設依賴，不維護 web 版）。
- 平板專屬版面列為後續（v1 以直向手機為主，但不得鎖死 iPad 可用性）。
- 不與 Web repo 共用程式碼套件（見 ADR-01）。

### 1.3 名詞

| 名詞 | 定義 |
|---|---|
| Route session | 地圖上有路線幾何 ⟺ 存在一個可「回到路線」與「結束路線」的常駐控制（Web `src/lib/route/routeSession.ts`） |
| Leg | 路線中單一運具段（WALK／BUS／MRT／TRA／DRIVE） |
| Local navigation | 由 App 端導航引擎驅動的導航 |
| Voice navigation | 由後端語音 session 驅動的導航（`navigationSource === "voice"`） |
| Action layer | AI 工具呼叫 → UI 動作（飛到地點、畫 marker、顯示路線、切面板）的共用管線 |

---

## 2. 參考系統概覽

- **規模**：Web `src/` 約 44k 行（`.tsx` 約 28k、`.ts` 約 15.7k），59 個 vitest 測試檔。
- **版面模型**：單頁地圖 + 一個 BottomSheet 元件依 `SheetMode` 切換面板內容（`home | place | plan | route | navigation | a11y | bus | parking | saved | welfare | environment | hazard | station`，以 Web `src/stores/map/types.ts` 為準）。面板由 `panelRegistry.tsx`／`railConfig.ts` 集中註冊。
- **狀態**：zustand；`useMapStore`（slice 組合，全 repo 最大 god node）、`useNavStore`、`useAuthStore`、`useChatStore`、`useVoiceStore`、`useOnboardingStore`。
- **可攜性分布**：
  - 純邏輯可近原樣移植：`lib/route`、`lib/transit`、`lib/geo.ts`、`lib/navigation/*`、`lib/ai/*`（除 `actionExecutor.ts`）、`lib/voice/voiceSession.ts`（刻意設計成無 DOM、依賴注入）、`voiceSessionBindings.ts`、`transcriptAggregator.ts`、`lib/authRefresh.ts`、`lib/fetch.ts`、`lib/place/*`、`lib/passwordValidation.ts`。
  - 必須重寫：所有 `.tsx` UI；`lib/voice/audioCapture.ts`、`audioPlayback.ts`（Web Audio）；`lib/map/basemap3d.ts`（依賴 maplibre-gl JS 實例）；`useNavigation.ts` 中 DOM 相關部分。

---

## 3. 架構決策紀錄（ADR）

| # | 決策 | 理由 | 被否決方案 |
|---|---|---|---|
| ADR-01 | **獨立 repo，邏輯以「移植＋來源紀錄」方式搬入** | 使用者決定；兩端工具鏈（Next/Biome/Vitest vs Expo/ESLint/Jest）與規範（本 repo 禁 `.then`、禁 ts-ignore）不同 | monorepo 共用 `packages/core`（使用者否決）；git submodule（維護成本高） |
| ADR-02 | **不做 DOM-component 全殼**；只在 AI 訊息 markdown 可選用 `'use dom'` | Capacitor 已等同 WebView 殼，重做無價值；DOM 畫面每個約 2 MB runtime | expo-web-to-native 預設的「day-one DOM shell」 |
| ADR-03 | 地圖：**`@maplibre/maplibre-react-native` 11.x** | 唯一能直接吃 Web 版 MapLibre style JSON（含 `fill-extrusion` 3D）的方案；有 Expo plugin；原生 `GeoJSONSource cluster`；`Camera.flyTo/fitBounds`。2026-09-25 核實（npm／repo 原始碼）：最新 11.4.0，peer `expo>=54`、`react-native>=0.80`，**只支援 New Architecture**；v11 改名 `MapView→Map`、`ShapeSource→GeoJSONSource`、Camera `easing="fly"`；`fillExtrusionOpacity` 有對應 `fillExtrusionOpacityTransition`（交叉淡化有 API，實際效果待 Spike A） | `react-native-maps`、`expo-maps`（不支援自訂 vector style／3D 圖層） |
| ADR-04 | 分群改用 **原生 GeoJSONSource cluster + SymbolLayer**，不再用 React view 當 marker | 原生端 React view marker 數量多時效能差；Web 版 supercluster 可淘汰 | 保留 `use-supercluster` + `<MarkerView>` |
| ADR-05 | 地圖上常駐 sheet **改為原生 sheet 優先**（見 ADR-15、§4.5）：iOS 以 Expo Router `formSheet`（`sheetAllowedDetents` + `sheetLargestUndimmedDetentIndex` 讓地圖在低 detent 可操作）或 `@expo/ui` `BottomSheet` + `presentationDetents` + `presentationBackgroundInteraction` 實作，二選一由 Spike C 決定；Android 以同一個 formSheet 為先，行為不足才退回 `@gorhom/bottom-sheet` | 原生 sheet 才能拿到 iOS 26+ Liquid Glass 與系統手勢／VoiceOver 行為；v0.1 以為 `@expo/ui` BottomSheet 只能模態，2026-09-25 查原始碼確認可經 modifier 設 detent 與背景互動（`node_modules/@expo/ui/src/swift-ui/modifiers/presentationModifiers.ts`） | 全部用 `@gorhom/bottom-sheet`（JS 繪製，拿不到玻璃效果；v0.1 原方案，降為 Android 備案） |
| ADR-06 | 語音音訊：**Spike B 比較兩案後定案**。候選 1：`expo-audio`（SDK 57 新增 `useAudioStream({sampleRate, channels, encoding:'float32', onBuffer})` 即時 PCM 擷取，Expo 官方維護）；候選 2：`react-native-audio-api` 0.13.x（`AudioRecorder.onAudioReady` 回傳 Float32 `AudioBuffer`、可指定 16000 Hz；`AudioBufferQueueSourceNode` 排程播放；`AudioManager.setAudioSessionOptions` 設 `playAndRecord`／`voiceChat`；需 `react-native-worklets`）。下行 24 kHz 播放目前只有候選 2 有已知 API | 兩者都有即時 PCM 擷取 API（2026-09-25 查 repo 原始碼）；**重取樣演算法（是否抗混疊）兩者都未核實**，是 spike 的核心判準 | `@siteed/expo-audio-studio`（最後發版 2026-06，社群維護風險）；自寫 Expo native module（備案） |
| ADR-07 | 串流 HTTP：**`expo/fetch` 的 `ReadableStream` + 自寫 SSE parser**（`shared/api/sse.ts`）；spike 失敗則改 `react-native-sse` | AI chat 是 POST SSE、SOS stream 需 Bearer header，原生 `EventSource` 都不適用；自寫 parser 可與 Web 版行為對齊 | `EventSource` polyfill 無 header 支援者 |
| ADR-08 | 儲存：token 用 **`expo-secure-store`**；zustand persist 用 **`react-native-mmkv` 4.x**（需 `react-native-nitro-modules`；2026-09-25 查：mmkv 4.3.2、nitro 0.37.1，peer 皆為 `*`，版本配對要在安裝後實跑確認） | Keychain／Keystore 保護憑證；MMKV 同步讀取可避免 hydrate 閃爍 | AsyncStorage（非同步、慢） |
| ADR-09 | 登入：**`@react-native-google-signin/google-signin`** + **`expo-apple-authentication`**；Email/密碼沿用 | App Store Guideline 4.8：提供 Google 登入即須提供同等隱私的登入（Sign in with Apple） | `expo-auth-session` 網頁式 OAuth（體驗差） |
| ADR-10 | 推播：**`expo-notifications`**；後端透過 Expo Push Service 發送（v1），保留日後改直連 APNs/FCM 的空間 | 後端目前完全沒有推播基礎設施，Expo Push 最低成本 | 自建 APNs/FCM（v1 成本過高） |
| ADR-11 | 測試：**`jest-expo`** 為主；純邏輯測試照 Web 版行為搬移 | Web 的 59 個測試守住最容易回歸的邏輯；規則：測試必須 import 真正的實作，不可在測試檔重寫謂詞 | 只靠模擬器手測 |
| ADR-12 | 平台分檔：沿用本 repo 規則（`Foo.types.ts` + `.tsx` + `.ios.tsx` + `.android.tsx`），**只有真的有平台差異的元件才拆**，純邏輯與無差異元件不拆 | 規則的目的是型別一致，不是強迫每個檔都有三份；否則會產生大量重複 | 每個元件一律三份 |
| ADR-13 | i18n：沿用 **i18next + react-i18next**，語系由 `expo-localization` 偵測；移除 `[lng]` 路由段 | 翻譯檔（`src/i18n/locale/{zh-TW,en}/translation.json`，各約 700 個頂層 key）可直接沿用 | 改用其他 i18n 函式庫 |
| ADR-14 | 狀態：沿用 **zustand 5**，但拆掉 Web 的 `useMapStore` god store，依 feature 各自擁有 store | 本 repo 規則要求 feature 自帶 store 且不互相 import 內部 | 原樣搬 god store |
| ADR-15 | **UI 原生元件優先**：能用 `@expo/ui/swift-ui`（iOS）／`@expo/ui/jetpack-compose`（Android）、Expo Router 原生 formSheet／`Stack.Toolbar`／native tabs、`expo-glass-effect` 就用；做不到才用 RN／JS 元件，並在該 feature 設計中寫明理由 | 使用者決策（2026-09-25）：要 iOS Liquid Glass 效果與原生互動；參考 https://docs.expo.dev/versions/latest/sdk/ui/swift-ui | 以 RN View＋StyleSheet 自繪（拿不到玻璃、需自己補無障礙語意） |

---

## 4. 系統架構

### 4.1 分層與依賴方向

```
app/（Expo Router：路由與畫面組裝）
  └─> features/<x>（index.ts 公開出口）
        ui/components ─> hooks ─> store ─> api ─> shared/api（transport）
                                       └─> domain（純邏輯，無 RN/Expo import）
  └─> shared/（跨 feature：api、storage、i18n、theme、location、a11y、ui、map-bridge）
```

規則：

1. 依賴只往下，UI 不直接呼叫 `fetch`（沿用 Web「API client → store／hook → UI」單向依賴）。
2. `features/*/domain/` 放純函式與型別，**不得 import `react-native`、`expo-*`**，才能用 jest 在 node 下測。移植自 Web `lib/` 的邏輯一律進 `domain/`。
3. feature 之間只能 import 對方 `index.ts` 的公開 API。跨 feature 的副作用（例：AI 要叫地圖飛到某處）走 §4.3 的 port，不直接改別人的 store。
4. 所有外部副作用（定位、音訊、儲存、網路、時間）以 port 介面注入，domain 與 controller 可在測試中替換（沿用 Web `VoiceSessionController`、`foregroundLocation.ts` 的依賴注入設計）。

### 4.2 目錄結構

```
src/
  app/
    _layout.tsx                 # Providers：Theme、i18n、GestureHandler、BottomSheetModalProvider、QueryBoundary、Toast
    index.tsx                   # 地圖主畫面（MapScreen）
    (modals)/
      auth.tsx                  # 登入／註冊／忘記密碼
      settings/index.tsx        # 設定首頁（@expo/ui List）
      settings/[section].tsx    # 帳號安全、AI 記憶、資料管理、無障礙偏好、語言
      sos.tsx                   # SOS 流程
      emergency-contacts.tsx
      hazard-report.tsx
      chat.tsx                  # AI 聊天（全螢幕 modal）
      help.tsx
    onboarding.tsx
    # verify-email、reset-password 不做原生頁：信件連結直接開瀏覽器到 Web 版（使用者決策 2026-09-25）
  features/
    map/        # 地圖、圖層、相機、2D/3D、設施點、MapController port 實作
    place/      # 搜尋、地點詳情、評論、收藏
    route/      # 路線規劃、路線卡、route session
    navigation/ # 導航引擎、HUD、reroute、TTS、背景定位
    bus/        # 即時公車、到站、路線詳情
    ai/         # 聊天、ThinkingTrace、action layer、AI 記憶
    voice/      # 語音 session、音訊擷取／播放
    sos/        # 求救、緊急聯絡人、SSE 生命週期
    hazard/     # 危險通報
    auth/       # 登入、token、帳號
    settings/   # 偏好設定、主題、語系、無障礙設定
    onboarding/ # 引導流程、需求輪廓
    welfare/    # 福利機構、環境資訊（空品）
  shared/
    api/        # fetch transport、ApiError、authenticatedRequest、SSE parser、WebSocket factory
    storage/    # MMKV 實例、SecureStore 包裝、persist adapter、schema version migration
    i18n/       # i18next 初始化、locale 檔、useAppTranslation
    theme/      # 既有；色彩 token、高對比、字級
    location/   # LocationPort（前景／背景）、heading
    a11y/       # 無障礙工具（announce、reduce motion、focus 管理）
    ui/         # 共用原生元件（Button、Sheet 容器、Toast、EmptyState、ErrorState）
    config/     # EXPO_PUBLIC_* 讀取與驗證
```

每個 feature 內部：

```
features/<x>/
  index.ts          # 公開出口（只匯出 screen、公開 hook、公開型別、port 實作）
  domain/           # 純邏輯（自 Web lib 移植）＋ __tests__
  api/              # 本領域 API client（一領域一檔，沿用 Web lib/api/* 分法）
  store/            # zustand store
  hooks/
  components/
  types/
```

### 4.3 跨 feature port（取代 Web god store 的直接存取）

| Port | 提供者 | 使用者 | 用途 |
|---|---|---|---|
| `MapController` | `features/map` | ai、navigation、place、route、sos | `flyTo`、`fitBounds`、`setPadding`、`showMarkers(layerId, features)`、`clearMarkers` |
| `SheetController` | `features/map`（sheet 狀態擁有者） | ai、place、route、navigation | `open(mode, payload)`、`snapTo(detent)`、`close()` |
| `RouteSessionPort` | `features/route` | ai、voice、navigation | `computeRoute(req)`（async）、`endRouteSession()`、`hasRouteSession()` |
| `NavigationPort` | `features/navigation` | voice、route | `startLocal(route)`、`adoptVoiceNavigation(state)`、`exit(reason)` |
| `AuthPort` | `features/auth` | shared/api | `getSession()`、`commitSession()`、`invalidateSession(captured)`（對應 Web `configureAuthState`） |
| `LocationPort` | `shared/location` | map、navigation、sos、voice、hazard | `getCurrent()`、`watch(opts)`、`startBackground(task)`、`watchHeading()` |

AI action layer（`features/ai/domain/toolActionMapper.ts` + `actionExecutor.ts`）只透過上述 port 執行 UI 動作，**聊天與語音兩條路徑共用同一個 executor**，而 async action（`compute-route`）必須由兩條路徑各自 await（見 §6.7 不變量）。

### 4.4 主畫面組成

```
MapScreen
 ├─ MapView（maplibre-react-native）
 │   ├─ BasemapLayers（2D/3D 群組、主題、語系標籤）
 │   ├─ FacilityLayer（elevator/ramp/toilet cluster）
 │   ├─ ParkingLayer、BusStopLayer、LiveBusLayer、HazardLayer
 │   ├─ RouteLayer（polyline + leg 顏色 + maneuver）
 │   ├─ AIResultLayer、SearchPinLayer、SosTrackerLayer
 │   └─ UserLocationPuck（含 heading）
 ├─ MapControls（定位、2D/3D、圖層、語音 FAB、SOS 按鈕）
 ├─ RouteSessionPill（shouldShowRoutePill 為真時顯示）
 ├─ NavigationHUD（導航中取代 sheet）
 ├─ VoiceFloatingIndicator
 └─ MapSheet（原生 formSheet stack，見 §4.5；detent：peek / half / full；內容依 sheet 路由）
```

### 4.5 原生 UI 策略與面板（ADR-05、ADR-15）

**原則**：先找 `@expo/ui` 或 Expo Router 的原生元件；只有原生元件做不到的版面（地圖上的 HUD、時間軸、shimmer）才用 RN View，且這類元件的底色一律用 `expo-glass-effect` `GlassView`（iOS 26+ 為 Liquid Glass，`isLiquidGlassAvailable()` 為 false 或使用者開「降低透明度」時退回不透明底色）。

**元件對照（2026-09-25 查 `node_modules/@expo/ui` 原始碼；Android 欄的 Compose 元件名稱來自同套件 `jetpack-compose/`，行為未實跑）**

| 用途 | iOS（`@expo/ui/swift-ui`） | Android（`@expo/ui/jetpack-compose`） |
|---|---|---|
| 設定頁、清單、表單 | `Host` + `List`／`Form`／`Section`／`LabeledContent`／`Toggle`／`Picker` | `LazyColumn` + `ListItem`／`Switch`／`SegmentedButton` |
| 模式切換（步行／大眾運輸／開車） | `Picker`（segmented） | `SingleChoiceSegmentedButtonRow` |
| 可展開明細（leg、步驟、ThinkingTrace 備案） | `DisclosureGroup`（`isExpanded` 受控） | `AnimatedVisibility` + `ListItem` |
| 進度／ETA | `ProgressView`、`Gauge` | `Progress`／`LoadingIndicator` |
| 確認（結束導航、SOS） | `ConfirmationDialog`／`Alert` | `AlertDialog` |
| 分享 | `ShareLink` 或 RN `Share.share` | RN `Share.share` |
| 滑動操作（刪收藏） | `SwipeActions` | — |
| 浮動按鈕（定位、2D/3D、圖層、語音、SOS） | `Button` + `buttonStyle('glass'｜'glassProminent')`、`GlassEffectContainer` 讓相鄰按鈕融合 | `FloatingActionButton`／`IconButton` |
| 空狀態／錯誤 | `ContentUnavailableView` | RN fallback |
| 圖示 | SF Symbols（`expo-symbols` `SymbolView`，可做 bounce／pulse 動畫） | Material Symbols |

**地圖主 sheet（常駐面板）**

- 結構：`app/index.tsx` 是地圖；面板是 Expo Router 的 `(sheet)` stack，以 `presentation: 'formSheet'` 呈現，`sheetAllowedDetents: [peek, 0.5, 1]`、`sheetLargestUndimmedDetentIndex: 1`（peek／half 時地圖不變暗且可操作）、`sheetGrabberVisible: true`，並禁止下滑關閉（常駐）。sheet 內部是原生 stack，面板之間用 push／back，得到系統返回手勢、導覽列與 VoiceOver 焦點管理。
- iOS 26+ 的 sheet 背景會自動套 Liquid Glass（系統行為）〔在 Expo Router formSheet 上**未核實**，Spike C 驗證〕。
- 備案：若 formSheet 無法禁止下滑關閉或 detent 切換不順，iOS 改 `@expo/ui` `BottomSheet` + `presentationDetents` + `presentationBackgroundInteraction({ enabledUpThrough })` + `interactiveDismissDisabled`；Android 改 `@gorhom/bottom-sheet`。
- `SheetController` port（§4.3）改為包裝 router：`open(mode)` = `router.push('/(sheet)/<mode>')`，`snapTo(detent)` 走 sheet 的 detent API；`SheetMode` 由目前 sheet 路由推導，不另存一份狀態（避免 Web 版 sheet 狀態與畫面不同步的問題）。

**第二期各面板的原生對應**

| 面板（Web `SheetMode`） | 路由 | 版面 |
|---|---|---|
| `home` | `(sheet)/index` | peek：搜尋框（`TextField`）＋快速動作列；half：最近搜尋、收藏 `List` |
| `plan` 路線規劃 | `(sheet)/plan` | 起訖點兩列（可交換）、模式 `Picker` segmented、無障礙偏好收在 `DisclosureGroup`、出發時間 `DatePicker` |
| `route` 路線列表 | `(sheet)/routes` | `List`，每列＝一條路線：總時間、到達時間、leg 圖示串（SF Symbols：`figure.roll`、`bus.fill`、`tram.fill`、`car.fill`）、無障礙亮點 badge；整列一個 `accessibilityLabel` 念出完整摘要 |
| 路線詳情／大眾運輸詳情 | `(sheet)/routes/[index]` | `List` + 每個 leg 一個 `Section`；transit leg 的經過站點用 `DisclosureGroup` 展開；開車事故、步行無障礙摘要用 `Label` 列；底部「開始導航」`buttonStyle('glassProminent')` |
| 公車 ETA（leg 內與 `bus` 面板） | `(sheet)/bus`、`(sheet)/bus/[routeId]` | 站牌列用 `LabeledContent`（站名／到站文字）；即將進站用 `Gauge` 或 `ProgressView`；方向用 `Picker` segmented；下拉更新 |
| POI／地點詳情 | `(sheet)/place/[id]` | 標題列＋動作列（導航、分享 `ShareLink`、收藏、複製）；無障礙屬性 `Section`；評論 `List` |
| `a11y` 設施詳情 | `(sheet)/facility/[id]` | 同上精簡版 |
| `navigation` 導航中 | **不在 sheet** | 見下方 HUD；sheet 收到 peek，內容換成「步驟清單」入口 |

**導航 HUD（第二期）**：導航時 sheet 收到最低 detent（或隱藏），地圖上疊兩塊 `GlassView` 卡片：

- 頂部：轉向 SF Symbol（`arrow.turn.up.right` 等，換步驟時 `SymbolView` bounce）、剩餘距離（大字、`accessibilityLiveRegion`）、下一步提示；leg 交接時換成交接卡（「在○○站下車，步行到△△」）。
- 底部：預計抵達時間／剩餘時間與距離、「步驟」「結束」兩個 glass 按鈕；「結束」→ `ConfirmationDialog`。
- 重算中：頂部卡片內換成 `ProgressView` + 「重新規劃路線中」，並 `announceForAccessibility`。
- 上架後候選：iOS Live Activity／動態島顯示同一份資料。

---

## 5. 路由與深層連結

- Scheme：`accessiblesmartmap://`（`app.json` 已設定）。
- v1 支援：
  - `accessiblesmartmap://place/<placeId>`：開地圖並開啟地點詳情（對應 Web `?place=`）
  - `accessiblesmartmap://loc/<lat>,<lng>`（對應 Web `?loc=`）
  - `accessiblesmartmap://route-preview/<sessionId>`（對應 Web LINE route preview）
- Email 驗證與重設密碼：**留在 Web**，信件連結一律開瀏覽器（使用者決策 2026-09-25），App 不實作這兩頁。App 內「忘記密碼」只負責呼叫寄信 API 並提示使用者去收信。
- Universal Links／App Links（`https://map.yuzen.dev/...`）只保留給分享連結（`place`／`loc`），列為 v1.x 候選（B-06）。
- 地點 ID 解析沿用 Web `ClientMap.tsx:44-59` `toPlaceId`：接受 `google:*`、`osm:node|way|relation:*`、舊式 `node_123`／`way_123`；`coord:` 開頭的 ID **不得**送進 `/search/details/:id`（會 400）。

---

## 6. Feature 設計

每節格式：能力 → 移植來源 → 原生設計 → 必守不變量 → 驗收要點。

### 6.1 map — 地圖與無障礙設施

- **能力**：電梯／坡道／無障礙廁所／停車（汽機車）／公車站點／即時公車／危險通報／SOS 追蹤／AI 結果／搜尋與路線 pin，皆可分群；2D/3D 建物切換；深淺色底圖跟隨主題；地圖標籤跟隨 UI 語系；點地圖任意處反查地址並開地點面板；`a11y` 篩選模式。
- **移植來源**：Web `src/components/ClientMap.tsx`、`src/lib/map/basemap3d.ts`、`src/components/Wrapper/*Wrapper.tsx`、`src/stores/map/*`、`src/lib/map/gpsErrorHandler.ts`。
- **原生設計**：
  - style JSON 直接沿用 Web 版（liberty／dark）；以 `mapStyle` 傳 URL 或物件。
  - 2D/3D：**不換 style**，在同 style 內對兩組 layer 做透明度交叉淡化（沿用 `basemap3d.ts` 的決策）。maplibre-react-native 的 layer props 是宣告式，淡化改由 state 驅動 `fillExtrusionOpacity` 等屬性；能否動畫過場於 Phase 0 spike 驗證。
  - 設施資料：`GET /api/v1/a11y/all-facilities?category=elevator,ramp,toilet`（約 1.6MB / 7.9k 筆）一次載入，MMKV 快取＋`ETag`／時間戳過期；轉成 GeoJSON 給 `GeoJSONSource cluster`。
  - Icon：`Images` 註冊 sprite，`SymbolLayer iconImage` 依 `category` expression 選圖；點擊 cluster → `getClusterExpansionZoom` 放大；點擊單點 → `SheetController.open("a11y", …)`。
  - 地圖語系：對 symbol layer 的 `textField` 以 expression 選 `name:zh-Hant`／`name:zh`／`name:en` fallback。
- **必守不變量**：
  - 2D/3D 切換不得 reload style（覆蓋圖層必須不受影響）；首次載入直接設定到位，不做淡入（Web `ClientMap.tsx:186-193`）。
  - 語系改寫只動 `textField` 內含 `"name"` 的 layer，且要做相等判斷避免無限重繪（Web `ClientMap.tsx:64-91`）。
  - GPS 錯誤退避：沿用 `gpsErrorHandler` 的計數與提示節流邏輯（改注入 MMKV）。
- **驗收**：7.9k 設施點在 iPhone 中階機種平移縮放維持流暢（目標 ≥ 50fps，以 Perf Monitor 量測）；VoiceOver 可聚焦並朗讀單點設施（需提供地圖外的「附近設施清單」作為無障礙替代路徑，見 §10）。

### 6.2 place — 搜尋、地點詳情、評論、收藏

- **能力**：自動完成搜尋、搜尋紀錄、收藏地點＋自訂分類、地點詳情（無障礙屬性）、結構化無障礙評論與星等、AI 評論摘要、分享、反查地址。
- **移植來源**：Web `src/lib/api/placeSearch.ts`、`src/lib/api/review.ts`、`src/lib/place/{adapters,lang,searchSession}.ts`、`src/stores/map/createSearchSlice.ts`、`src/components/BottomSheet/{PlaceContent,PlaceReviewSection,SavedPlacesPanel}.tsx`。
- **後端**：`GET /api/v1/a11y/search/autocomplete`、`GET /search/details/:id`、`GET /reviews`、`GET /reviews/summary`、`POST|PATCH|DELETE /reviews[/:id]`（需登入）。權威遷移指南：後端 `docs/FRONTEND_MIGRATION_PLACE_SEARCH.md`、`docs/FRONTEND_MIGRATION_STRUCTURED_ACCESSIBILITY_REVIEWS.md`。
- **原生設計**：搜尋框在 sheet peek 狀態常駐；輸入時 sheet 升到 full；Google Places session token 沿用 `createSearchSessionToken`；分享文字／連結用 RN `Share.share`（或 iOS `ShareLink`），分享檔案才用 `expo-sharing`（它只接受本機檔案 URI），複製用 `expo-clipboard`；收藏存 MMKV（v1 仍為本機資料，後端無收藏 API）。
- **必守不變量**：
  - 評論 key 已由 `osmId` 改為 `placeId`；`placeKey` 格式變動會讓 `savedPlaceCategories` 對應失效。
  - `coord:` 條目不得呼叫 details；座標型條目遷移要原樣保留。
  - 刪除成功回應為 205 且 `data: null`，client 不得假設 `data` 存在。
- **驗收**：中英文前綴搜尋可用；收藏跨重啟保留；分享連結可被 App 深層連結開啟。

### 6.3 route — 路線規劃

- **能力**：步行／大眾運輸／開車多模式規劃、路線排序、無障礙亮點標籤、大眾運輸 leg 詳情（站點、ETA）、開車事故提示、步行無障礙摘要、AI 路線說明、「回到路線」常駐 pill。
- **移植來源**：Web `src/hook/useComputeRoute.ts`、`src/lib/route/routeSession.ts`、`src/lib/geo.ts`、`src/lib/routePreviewAdapter.ts`、`src/types/route.ts`、`src/components/shared/RouteCard/*`、`src/components/Route/RouteSessionPill.tsx`。
- **後端**：`POST /api/v1/a11y/accessible-route`（選擇性登入）、`POST /accessible-route/reroute`、`POST /route/instructions`（body 只收 `{routeToken, userHeading?, language}`）、`POST /api/v1/ai/explain`、`GET /api/v1/line/route-preview`。
- **原生設計**：面板對應見 §4.5「第二期各面板的原生對應」；路線卡用 `@expo/ui` `List`（每列一個完整語意描述）；leg 展開用 `DisclosureGroup`。
- **必守不變量**：
  - **Route session**：路線幾何在地圖上 ⟺ 有常駐控制可回到並結束它；切換到其他功能**不得**毀掉已規劃路線；只有 `endRouteSession()` 能清除，且清除清單必須包含 origin／destination（Web 曾因漏清導致 pin 殘留）。
  - `hasRouteSession()`：只有 `destination` 還沒算出路線也算 session；`shouldShowRoutePill()` 是 pill 顯示的唯一判斷（聊天開啟時覆蓋其他例外）。
  - 後端 schema 普遍為 Zod `.strict()`：**request 多帶任何欄位即 400**；`/route/instructions` 只能送 `routeToken`，不得送整個 route 物件。
  - `polylineIndex` 是 **per-leg**，必須搭配 `legIndex` 取 `route.legs[legIndex].polyline[polylineIndex]`；超出範圍要 clamp（Web `src/lib/geo.ts:69,173,194-208`）。
  - 選擇性登入端點：token 過期回 401、無效回 403，**不得**自動降級為匿名重送，應引導重新登入。
- **驗收**：WALK→MRT→WALK、WALK→BUS→WALK、DRIVE 三型路線的 leg 詳情與 polyline 分段正確；切到公車／設定再回來，路線與 pill 仍在。

### 6.4 navigation — 逐步導航

- **能力**：導航 HUD（轉向圖示、距離、進度）、偏航偵測與自動／手動重算、重算中遮罩、抵達偵測、離開導航確認、步驟清單、語音播報（本機 TTS 與語音助理二擇一）、螢幕常亮、**背景持續導航（新增）**。
- **移植來源**：Web `src/hook/useNavigation.ts`（約 750 行，需拆解）、`src/lib/navigation/*`（`advisorySpeech`、`navigationAudio`、`navigationGeometryRuntime`、`navigationLifecycle`、`legMode`、`localRerouteCoordinator`、`rerouteCoordinator`、`foregroundLocation`）、`src/stores/useNavStore.ts`、`src/components/Navigation/*`。
- **原生設計**：
  - 引擎：把 `useNavigation.ts` 拆成 `domain/navigationEngine.ts`（純函式：位置 → 進度／偏航／抵達判斷）＋ `NavigationController`（持有 LocationPort、TTS、計時器）＋ 薄 hook。
  - 定位：前景 `expo-location watchPositionAsync`（`BestForNavigation`）；進入背景時由 `expo-task-manager` 背景任務接手（iOS `UIBackgroundModes: location`、Android foreground service 通知）。背景任務在 JS 頂層 `defineTask`，只寫入 store／計算進度與播報，不操作 UI。
  - 方位：`watchHeadingAsync`（取代 `DeviceOrientationEvent` 與 iOS 權限請求）。
  - 播報：`expo-speech`（zh-TW／en 語音；啟動時檢查可用語音，缺 zh-TW 語音時顯示提示）；`expo-haptics` 在轉彎前震動；`expo-keep-awake` 導航期間常亮。
  - HUD 與 sheet 互斥；導航中 sheet 收為步驟清單入口（HUD 版面見 §4.5）。
- **必守不變量**：
  - 兩個喇叭（本機 TTS 與語音助理音訊）**不得同時發聲**；語音 session 在本機導航中啟動時不得搶走喇叭按鈕或把本機 TTS 靜音（Web `src/lib/navigation/navigationAudio.ts:4-21`）。
  - 語音後端交接的步驟沒有 `polylineIndex`，必須以 leg-relative 方式推算（Web `useNavigation.ts:59-95`）。
  - 抵達只設定一次（`if (!nav.arrived)` 守門）；**不要**以放寬抵達閾值處理「一按導航就抵達」類問題（根因是 per-leg 索引錯配）。
  - `REROUTE_COOLDOWN_MS` 冷卻，避免重算風暴。
  - Leg 交接卡（下車→步行到下一段）判斷沿用 `findLegHandoffIndex`／`isLegHandoff`／`isVehicleLegType`。
- **驗收**：iOS 模擬器以 GPX 路線模擬行走，鎖螢幕／切到背景後仍持續播報與更新進度；偏航 20 m 以上觸發重算且冷卻有效；多段路線 leg 交接正確。

### 6.5 bus — 即時公車

- **能力**：地圖即時公車位置（兩次輪詢之間內插動畫）、站點 ETA、公車面板（附近站牌、路線／站牌搜尋）、路線詳情（依方向列站）。
- **移植來源**：Web `src/hook/{useLiveBusPositions,useAnimatedBuses,useBusLegStopEtas,useBusSearch}.ts`、`src/lib/transit/{busLegStops,busRouteDetailCache}.ts`、`src/lib/api/transit.ts`。
- **後端**：`/api/v1/transit/bus/{positions,realtime,arrival,route-detail,search-routes,search-stops,nearby-stops,timetable}`、`/transit/alerts`（皆 PUBLIC，輪詢）。
- **原生設計**：輪詢由 controller 以 AppState 控制（背景暫停、回前景立即刷新）；公車位置動畫以 Reanimated shared value 內插後寫入 GeoJSON source（每 frame 更新 source 太重時降為 5–10 fps）。
- **必守不變量**：
  - `leg.direction` 不可信（TDX 兩方向編號不一致；365、26 反向，70 不反）：凡拿 leg 方向問 TDX 前都要先 `resolveLegDirection`／`resolveLegRide`（先試宣告方向、再試另一方向、最後才用幾何比對；Web `busLegStops.ts:100-172`）。
  - 站名比對要正規化（臺／台、括號月台註記），**精確比對先於 containment**。
  - 「整段所有站同一狀態文字」是方向挑錯的辨識特徵，應列為測試案例。
  - `route-detail` 的 `statusLabel` 是複合欄位（尚未發車時會被覆寫成下一班時刻），`arrival` 端點則不會；UI 不可混用兩者語意。
- **驗收**：以 365、26、70 三條路線驗證 leg 站點與 ETA 方向正確；背景 5 分鐘後回前景，資料立即更新。

### 6.6 ai — AI 聊天助理

- **能力**：串流聊天、markdown 顯示、ThinkingTrace（工具呼叫進行中／完成）、快速動作、AI 記憶管理、工具結果驅動地圖（marker、飛到、顯示路線、切面板）。
- **移植來源**：Web `src/hook/useAIChat.ts`、`src/hook/useSmoothStream.ts`、`src/lib/ai/{thinkingTrace,streamingText,toolLabels,toolActionMapper,actionExecutor,uiAction,orbState}.ts`、`src/lib/aiResults.ts`、`src/lib/toolResultCards.ts`、`src/lib/api/{ai,memory}.ts`、`src/stores/useChatStore.ts`、`src/stores/useQuickActionsStore.ts`。
- **後端**：`POST /api/v1/ai/chat`（選擇性登入；回應為 `text/event-stream`，事件：`token`、`tool_call`、`tool_result`、`error`、`done`）、`POST /ai/intent`、`/ai/memories[/:id]`、`/ai/memories/settings`（需登入）。
- **原生設計**：
  - 聊天畫面為全螢幕 modal（`(modals)/chat.tsx`），`KeyboardAvoidingView`／inverted `FlatList`。
  - 串流：`shared/api/sse.ts`（`expo/fetch` 讀 `ReadableStream`，依 `\n\n` 切事件）；取消以 `AbortController`。
  - Markdown：`@expo/ui` `Text` 的 `markdownEnabled` 只支援 SwiftUI 行內語法（粗體、斜體、連結、行內程式碼），**不含清單、表格、程式碼區塊**，只適合短回覆。完整渲染在 Phase 4 開頭做小 spike 比較：(a) JS markdown → RN `Text` 樹的渲染器（套件選型與維護狀態未核實）；(b) `'use dom'` 元件承載 Web 版 `StreamingMarkdown`（ADR-02 唯一例外，行為與 Web 完全一致，但每個 DOM 元件有 WebView 成本，只能整段對話共用一個，不能每則訊息一個）。判準：串流時不整段重播（§6.6 不變量）、VoiceOver 可逐段閱讀、連結 sanitize。
  - ThinkingTrace（對齊 Web `src/components/ai/ThinkingTrace.tsx`：header＝狀態 orb＋shimmer 文字＋展開箭頭；執行中自動展開、完成後收合；展開後是左側細線串起的工具呼叫時間軸）：
    - 資料：`domain/thinkingTrace.ts` 原樣移植（`TraceRow`、`ThinkingHeader`），元件只畫圖。
    - 主案（RN 組合，ADR-15 例外，理由：SwiftUI 元件沒有 shimmer 與時間軸版面）：header 放在 `GlassView` 膠囊內；orb 改用 `SymbolView`（`sparkles`，執行中 pulse／variable color 動畫；Web 的 `thinking-orbs` 是 canvas，不移植）；shimmer 用 Reanimated 動畫的漸層遮罩；展開收合用 Reanimated layout animation；row 狀態圖示 `SymbolView`（執行中 `circle.dotted` 旋轉、完成換成 `checkmark.circle.fill` 並 bounce 一次）。減少動態效果開啟時全部改為靜態。
    - 備案（全原生、較樸素）：`@expo/ui` `DisclosureGroup`（`isExpanded` 綁 auto-expand 規則）＋每列 `Label`（SF Symbol）＋執行中 `ProgressView`。
    - 無障礙：header 是按鈕（`accessibilityState.expanded`），狀態文字 `accessibilityLiveRegion="polite"`，對應 Web 的 `aria-live`。
  - 聊天紀錄：Web 用 `sessionStorage`（重整保留、關瀏覽器清除）；原生對應為 **記憶體＋App 生命週期內保留**，冷啟動清除（可設定是否保留）。
- **必守不變量**：
  - **雙路徑**：聊天與語音是兩條獨立執行路徑，共用 `mapToolToActions` + `executeAction`；`executeAction` 只提供同步 stub，**async action（`compute-route`）必須由兩條路徑各自接線 await**（Web 曾漏接語音端 → 路線面板永久轉圈）。
  - `streamingText` 必須區分「前綴延伸」與「重置」，避免整段重播閃爍；blur-tail 只作用於尾端 `BLUR_TAIL_CHARS = 6`。
  - 判斷邏輯留在 domain 純函式（`thinkingTrace.ts`）以便測試，元件只做呈現。
  - Web 有 import cycle `lib/api/ai.ts → lib/fetch.ts → stores/useAuthStore.ts → stores/useChatStore.ts → lib/api/ai.ts`，移植時以 `AuthPort` 切斷，**不得複製**。
- **驗收**：從聊天叫「規劃到台北車站的無障礙路線」→ sheet 顯示路線且不卡轉圈；工具呼叫期間 ThinkingTrace 狀態正確；中途取消不殘留半截訊息。

### 6.7 voice — 語音助理

- **能力**：浮動麥克風、即時雙向語音（後端代理 Gemini Live）、即時逐字稿與修正、工具呼叫視覺化、語音中規劃路線並交接導航、斷線重連並恢復後端導航。
- **移植來源**：Web `src/lib/voice/voiceSession.ts`（991 行，無 DOM、依賴注入，**近原樣移植**）、`voiceSessionBindings.ts`、`transcriptAggregator.ts`、`audioLevel.ts`、`navProgress.ts`、`voiceNavigationExit.ts`；重寫 `audioCapture.ts`、`audioPlayback.ts`、`useVoiceSession.ts`。
- **協定**（後端 `docs/specs/VOICE_WS_PROTOCOL.md`，實作前需整份閱讀）：
  - URL `wss://<host>/api/v1/voice/ws`；連線後第一個 text frame 必須是 `{type:"session.start", token, userLocation?}`，5 秒內未認證以 `4401` 關閉；同帳號第二條連線以 `4409` 取代舊連線；濫用以 `4408` 關閉。
  - 上行：**PCM16 LE、16000 Hz、mono，每 1600 samples（100 ms）一個 binary frame**；單 frame 上限 64KB。
  - 下行：**PCM16 LE、24000 Hz、mono**，chunk 長度不固定，需依序排程播放。
  - 控制訊息：`session.end`、`nav.setRoute{routeToken}`、`nav.position`、`nav.cancel`、`nav.start`、`nav.resume{navigationId,routeVersion,routeToken,lastKnownStepIndex,currentPosition?}`；伺服器事件：`session.ready`、`error`、`interrupted`、`tool_call`、`tool_result`、`transcript`、`transcript.correction`、`turn.complete`、`nav.*`。
- **原生設計**：
  - `AudioCapturePort` 實作：`react-native-audio-api` `AudioRecorder`（`sampleRate: 16000`、`channelCount: 1`、`bufferLength: 1600`）→ Float32 轉 Int16 → `ws.send(ArrayBuffer)`。
  - **重取樣必須有抗混疊**：若裝置無法直接以 16 kHz 擷取，必須用函式庫內建重取樣或帶 low-pass 的重取樣，**禁止**「每 N 個取 1 個」的裸抽稀（會 aliasing 並造成 44.1 kHz 裝置變速變調；後端協定文件 §258-259 明文禁止）。
  - `AudioPlaybackPort` 實作：`AudioContext({sampleRate: 24000})` + `AudioBufferQueueSourceNode` 依序排隊；`interrupted` 事件時清空佇列。
  - 音訊 session：iOS 設為 `playAndRecord` + `voiceChat` 模式（回音消除）、允許藍牙；與導航 TTS 的喇叭仲裁走 `navigationAudio` 規則。
  - WebSocket：RN 內建 `WebSocket`，`binaryType = "arraybuffer"`（預設 `blob` 會靜默丟掉所有音訊 frame）。
- **必守不變量**：
  - 先建立 socket 再掛 handler 的順序（Web `voiceSession.ts:355`）。
  - `nav.resume` 只在**重連**的 `session.ready` 後送，首次連線不送；只有 `isNavigating && navigationSource === "voice" && !arrived` 才可恢復。
  - async tool action 的接線見 §6.6「雙路徑」。
- **驗收**：真機（模擬器麥克風不可靠）連續對話 5 分鐘無爆音、無變調；說話中打斷可立即停止播放；關閉 Wi-Fi 再開，語音導航可恢復到原步驟。

### 6.8 sos — 求救

- **能力**：求救者發起 SOS、即時狀態與處理歷程（由誰處理）、分享追蹤連結、緊急聯絡人管理（上限 5 人）、App 重啟後復原進行中的 SOS（12 小時內）、前往求助者導航。
- **移植來源**：Web `src/hook/useSosLifecycle.ts`、`src/lib/sosSession.ts`、`src/lib/api/sos.ts`、`src/components/Sos/*`、`src/components/Wrapper/SosTrackerWrapper.tsx`。
- **後端**：`POST /api/v1/sos/sessions`、`PATCH /sessions/:id/location`、`PATCH /sessions/:id/resolve`、`GET /sessions/:id`、`GET /sessions/:id/stream`（**GET SSE、需 Bearer header**）、`GET /sessions/:token/public`（以 `shareToken` 為 key，不是 session id）、`/api/v1/user/emergency-contacts`。
- **原生設計**：
  - 生命週期：先 GET snapshot → SSE 訂閱 → 最多重試 3 次 → 退回每 8 秒輪詢（沿用 Web 策略）；App 進背景時 SSE 會斷，**以推播（B-04）通知狀態變更**，回前景重新 snapshot。
  - SOS 期間定位：前景持續上傳；背景上傳沿用 navigation 背景任務機制（需求者可能鎖屏）。
  - 大型觸控目標（≥ 64 pt）、確認流程防誤觸、長按觸發選項；`expo-haptics` 回饋；撥打緊急電話用 `Linking.openURL("tel:...")`。
- **必守不變量**：本機儲存只是「復原提示」，是否仍進行中**以伺服器為準**（每次復原都 GET 驗證）；復原檢查只執行一次。
- **驗收**：發起 SOS → 殺掉 App → 重開仍顯示進行中並持續更新；處理者狀態變更在背景時收到推播。
- **備註**：Web 版 SOS 沒有單元測試，本 repo 移植時補上 lifecycle 狀態機測試。

### 6.9 hazard — 危險通報

- **能力**：在位置上回報危險（類型、三級嚴重度：minor／difficult／blocking）、必附照片、描述；查看附近通報；確認他人通報；我的通報。
- **移植來源**：Web `src/components/BottomSheet/HazardReportPanel.tsx`（`validateHazardPhoto`、嚴重度常數）、`src/lib/api/a11y.ts`（`submitHazardReport` 等）、`src/components/Wrapper/HazardWrapper.tsx`。
- **後端**：`POST /api/v1/a11y/reports`（選擇性登入，`multipart/form-data`，單一欄位 `photo`，接受 jpeg/png/webp/heic/heif，後端上限預設 10MB）、`GET /reports`、`GET /reports/mine`、`POST /reports/:id/confirm`。
- **原生設計**：`expo-image-picker`（相機／相簿）；上傳前以 `expo-image-manipulator` 壓縮到前端上限 5MB 以下；`FormData` 附 `{uri, name, type}`。
- **驗收**：iPhone 預設 HEIC 照片可上傳；匿名與登入兩種身分都可送出。

### 6.10 auth — 帳號

- **能力**：Email 註冊／登入、Google 登入（iOS／Android）、**Apple 登入（新增）**、Email 驗證重寄、忘記密碼（寄信）、登入中改密碼、LINE 綁定碼、登出、啟動時靜默續期。Email 驗證與重設密碼的**落地頁留在 Web**，信件連結開瀏覽器。
- **移植來源**：Web `src/lib/authRefresh.ts`、`src/lib/fetch.ts`、`src/lib/authTransport.ts`、`src/lib/api/{auth,user}.ts`、`src/lib/passwordValidation.ts`、`src/stores/useAuthStore.ts`。
- **原生設計**：
  - Access token 放記憶體＋SecureStore；refresh token 放 SecureStore。後端 refresh 不再只靠 httpOnly cookie（B-01，使用者已決定會要求後端改）。
  - `shared/api/fetch.ts`：`fetchRequest`／`authenticatedRequest` 沿用 Web 的 401-retry-once 語意。
  - Google：`GoogleSignin.configure({ webClientId, iosClientId })`，取得 `idToken` 送 `POST /auth/google`；後端 `verifyIdToken` 的 audience 要同時接受 web、iOS、Android client ID（B-02）。
  - Apple：`expo-apple-authentication` 取得 `identityToken` 送新端點 `POST /auth/apple`（B-03）；僅 iOS 顯示。
- **必守不變量**（本 feature 是移植價值最高的邏輯，應逐行移植並搬測試）：
  - **Single-flight refresh**：同一身分併發請求只能有一條 refresh lane；logout→relogin 期間進行中的 refresh 不得覆蓋新 session（ABA 問題；Web `authRefresh.ts:99-105`）。
  - **Compare-and-commit 失效**：只有當前 session 與失敗前擷取的 reference 相同時才清除（Web `authRefresh.ts:125-133`）。
  - 403（非 401）代表伺服器端撤銷（tokenVersion 變動）：立即失效，不嘗試 refresh（Web `fetch.ts:110-126`）。
  - `POST /auth/password` 以 401 表示「目前密碼錯誤」（業務錯誤），呼叫時必須 `skipAuthRetry: true`，否則打錯密碼會被登出（Web `fetch.ts:13-18`）。
  - 「登入已過期」提示只在 session 結算為空時出現；身分已被替換時保持安靜。
  - refresh／logout 走獨立 transport，不經過 `fetchRequest`，避免觸發 401-refresh 遞迴。
- **驗收**：Web 版 `authRefresh.test.ts`、`useAuthStore.test.ts` 移植後全綠；並發 10 個過期請求只觸發 1 次 refresh；App 冷啟動自動續期成功。

### 6.11 settings、onboarding、welfare、help

- **settings**：主題（系統／淺／深）、高對比、字級（跟隨系統 Dynamic Type，另提供 App 內倍率）、語系（zh-TW／en）、無障礙需求輪廓（`GET|PUT /api/v1/user/a11y-profile`，影響預設路線偏好）、帳號安全、AI 記憶、資料管理（清除快取、快速動作、最後位置）。以 `@expo/ui` 原生 List／Switch／Picker 實作。
- **onboarding**：`IntroStep`、`NeedsStep`（建立需求輪廓）、定位權限說明頁（在系統權限彈窗前先說明用途，也是審查要求）；CoachMarks 改為一次性提示卡，避免覆蓋整個畫面而干擾螢幕閱讀器。
- **welfare／environment**：`GET /api/v1/a11y/welfare[/nearby|/:id]`、`GET /api/v1/a11y/environment`、`GET /api/v1/air/air-quality`。
- **help**：靜態內容頁。

---

## 7. 資料層設計

### 7.1 設定

| 變數 | 說明 |
|---|---|
| `EXPO_PUBLIC_END_POINT` | API base URL。Web 版 dev 為 `https://map-dev.yuzen.dev`；正式 API 主機名稱**未在後端 repo 宣告**，需向部署負責人確認 |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | Google 登入的 web client ID（idToken audience） |
| `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` | iOS client ID |
| `EXPO_PUBLIC_SHARE_BASE_URL` | 分享連結網域（對應 Web `NEXT_PUBLIC_URL`，`https://map.yuzen.dev`） |

`shared/config` 啟動時以 schema 驗證，缺值直接顯示設定錯誤畫面，不以預設值默默連到 localhost。

### 7.2 API 回應與錯誤模型

- 回應型別沿用 Web `src/types/response.d.ts` 的 `ApiResponse<T>`；所有回應以 type guard／schema 收窄，**禁止 `any`**。
- `ApiError { status, code, message, retriable }`；UI 以錯誤碼對應 i18n 訊息。
- 205／`data: null` 視為成功。
- 網路狀態以 `@react-native-community/netinfo`（或 Expo 對應模組）偵測；離線時唯讀快取可用（設施、收藏、最後路線），寫入操作提示離線。

### 7.3 本機儲存對照

| Web 儲存 | 原生儲存 | 備註 |
|---|---|---|
| refresh token（httpOnly cookie） | SecureStore | 依 B-01 |
| access token（記憶體） | 記憶體＋SecureStore | |
| `searchHistory`、`savedPlaces`、`savedPlaceCategories`、`placeSchemaVersion` | MMKV（zustand persist） | 保留 schema version 與「全部寫完才更新版本號」的遷移規則 |
| `lastUserLocation` | MMKV | |
| `sos.activeSession`（12h） | MMKV | 只作復原提示 |
| `quickActions`、onboarding 旗標、`theme`、高對比 | MMKV | |
| 聊天紀錄（sessionStorage） | 記憶體 | 見 §6.6 |
| 設施資料集快取 | MMKV 或 `expo-file-system`（約 1.6MB JSON） | 依 spike 量測選擇 |

### 7.4 即時通道

| 通道 | 協定 | 認證 | 原生實作 |
|---|---|---|---|
| AI chat | POST SSE | 選擇性 Bearer | `shared/api/sse.ts` |
| SOS 生命週期 | GET SSE | 必須 Bearer | `shared/api/sse.ts` + 輪詢備援 + 推播 |
| 語音 | WebSocket | 首個訊息帶 token | RN `WebSocket`（`arraybuffer`） |
| 公車位置 | 輪詢 | 無 | AppState 感知的 interval |

---

## 8. 後端變更需求

| ID | 變更 | 原因 | 優先級 | 需要於 |
|---|---|---|---|---|
| B-01 | `/user/refresh` 支援非 cookie 管道：原生 client（例如帶 `X-Client: mobile`）登入時於 body 回傳 refresh token；refresh 時接受 body 或 header；保留 web 的 httpOnly cookie 路徑 | 目前只讀 `req.cookies.refreshToken`（後端 `src/modules/user/user.controller.ts:186`），原生無法可靠使用 | P0 | Phase 1 |
| B-02 | Google `verifyIdToken` 的 `audience` 改為陣列（web、iOS、Android client ID） | 目前只接受單一 `GOOGLE_CLIENT_ID`（後端 `user.auth.service.ts:421-443`） | P0 | Phase 3 |
| B-03 | 新增 Sign in with Apple（`POST /auth/apple`，驗證 identityToken，比照 Google 的帳號連結邏輯） | App Store Guideline 4.8 | P0（iOS 上架必要） | Phase 3 |
| B-04 | 推播：`POST/DELETE /api/v1/user/push-tokens`（Expo push token、平台、語系）＋ SOS 狀態變更與通報審核結果推送 | 後端完全沒有推播基礎設施；SOS 在背景時 SSE 會斷 | P1 | Phase 3 |
| B-05 | 修正 refresh cookie `maxAge`（7 天）與 token `exp`（1 天）不一致；原生管道採一致 TTL，並考慮 refresh token rotation | 過期行為難以預期（後端 `src/config/lib.ts:78` vs `src/config/jwt.ts`） | P2 | Phase 1 |
| B-06 | 〔v0.2 縮小範圍〕Email 驗證與重設密碼**維持開 Web**，不需改。只剩分享連結要 Universal Link 時，才於 `map.yuzen.dev` 提供 `apple-app-site-association` 與 `assetlinks.json` | 使用者決策：這兩頁留在 Web | P3 | v1.x |
| B-07 | 確認正式環境 API 主機名稱與反向代理 `trust proxy` hop 數 | 匿名通報以 IP hash 識別、rate limit 以 IP 為 key | P1 | Phase 0 |
| B-08 | 新增帳號刪除 API（`DELETE /api/v1/user`，連同緊急聯絡人、AI 記憶、推播 token；評論與通報匿名化或刪除） | App Store 要求可在 App 內刪除帳號；後端 `src/modules/user/user.router.ts` 目前沒有刪除端點 | P0（上架必要） | Phase 3 |

---

## 9. 平台設定（`app.json` / config plugins）

| 項目 | 設定 |
|---|---|
| 地圖 | `@maplibre/maplibre-react-native` plugin |
| 定位 | `expo-location` plugin：`locationWhenInUsePermission`、`locationAlwaysAndWhenInUsePermission`（中英文用途說明）、`isAndroidBackgroundLocationEnabled`、`isAndroidForegroundServiceEnabled`；iOS `UIBackgroundModes: ["location", "audio"]`（audio 只在語音導航需要背景播報時加，需評估審查影響） |
| 麥克風 | `NSMicrophoneUsageDescription`、Android `RECORD_AUDIO`；`react-native-audio-api` plugin |
| 相機／相簿 | `expo-image-picker` plugin 用途說明 |
| 推播 | `expo-notifications` plugin、APNs key、FCM 設定（EAS credentials） |
| 登入 | `@react-native-google-signin/google-signin` plugin（iosUrlScheme）、`expo-apple-authentication`（`usesAppleSignIn: true`） |
| 既有 | `plugins/with-ios-scene-lifecycle.ts`：新增的原生 plugin 若修改 AppDelegate，必須與它相容（它找不到預期程式碼時會 throw） |

需要 dev build（不能用 Expo Go）：maplibre、audio-api、mmkv、google-signin、背景定位。Phase 0 第一步就切到 dev build 工作流程。

---

## 10. 無障礙需求（本 App 的核心品質）

| 類別 | 要求 |
|---|---|
| 螢幕閱讀器 | 所有互動元素有 `accessibilityLabel`／`accessibilityRole`／`accessibilityState`；自訂元件不得只靠圖示傳達資訊；VoiceOver 與 TalkBack 各走一次完整主流程 |
| 地圖替代路徑 | 地圖內容對螢幕閱讀器不可靠，必須提供「附近設施清單」「路線文字步驟」等同等資訊的列表視圖 |
| 動態字級 | 支援 iOS Dynamic Type／Android 字型縮放到最大級距不截字；不得鎖字級 |
| 觸控目標 | ≥ 44×44 pt（iOS）／48×48 dp（Android）；SOS 主按鈕 ≥ 64 pt |
| 對比 | 文字對比 ≥ 4.5:1；高對比模式 ≥ 7:1；地圖圖示在深淺底圖皆可辨識 |
| 動態效果 | 尊重「減少動態效果」（`AccessibilityInfo.isReduceMotionEnabled`）：關閉 3D 過場、公車內插動畫降級 |
| 狀態播報 | 路線算完、重算、抵達、SOS 狀態變更以 `AccessibilityInfo.announceForAccessibility` 播報 |
| 焦點 | Sheet 開啟時焦點移入 sheet 標題；關閉時回到觸發元件；modal 內焦點不外漏 |
| 語音控制 | 按鈕標籤文字與 label 一致（Voice Control／Voice Access 可用名稱點選） |

---

## 11. 測試與驗證策略

| 層級 | 工具 | 範圍 |
|---|---|---|
| Domain 單元測試 | `jest-expo`（node 環境跑純函式） | 所有自 Web `lib/` 移植的模組，**連同其 Web 測試一起移植**；新增 SOS lifecycle 測試 |
| Store／controller 測試 | jest + 注入 fake port | auth refresh 併發、voice session 狀態機、navigation engine |
| 元件測試 | `@testing-library/react-native` | 只測有條件邏輯的元件；邏輯優先抽到 domain |
| 端到端 | iOS 模擬器實跑（依本 repo CLAUDE.md），Maestro flow 記錄主流程 | 每期驗收清單 |
| 真機 | TestFlight／Play 內測 | 語音、背景定位、推播、VoiceOver／TalkBack（模擬器無法驗證） |
| 對照 | 同一操作在 Web（`map.yuzen.dev`）與 App 比對**內容與行為**（不是像素） | 路線結果、公車站點、評論 |

測試規則：測試必須 import 真正的實作；不可在測試檔內重寫一份邏輯來測（「複製品測試」＝沒測）。交付前 `npm run typecheck`、`npm run lint`、`npm test` 零錯誤零警告。

**Vitest → Jest 轉換規則**（Web 59 個測試檔隨所屬 feature 在各期移植，清單見 ROADMAP 各期）：

| Vitest | Jest（`jest-expo` preset） |
|---|---|
| `import { describe, it, expect, vi } from 'vitest'` | 全域 `describe`／`it`／`expect`（`tsconfig` `types: ["jest"]`，TS 6 不再自動載入 `@types/*`） |
| `vi.fn`／`vi.spyOn`／`vi.mock` | `jest.fn`／`jest.spyOn`／`jest.mock`（`jest.mock` 會 hoist；工廠內引用外部變數要以 `mock` 開頭） |
| `vi.useFakeTimers`／`vi.advanceTimersByTime`／`vi.setSystemTime` | 同名 `jest.*` |
| `vi.stubGlobal('localStorage', …)` | 改注入 storage port 的 in-memory 實作，不 stub 全域 |
| `vi.hoisted` | 刪除，改用 `mock` 前綴變數 |
| `import.meta.env` | `process.env.EXPO_PUBLIC_*`，並經 `shared/config` |
| 測試 DOM／`window` 的案例 | 先判斷該行為在原生是否還存在；不存在就刪測試並在 port-ledger 記錄原因，不能硬造 DOM |

移植順序：先原樣搬測試並跑紅，再移植實作讓它轉綠——確保測試守的是 Web 版的行為，而不是新寫的實作。

---

## 12. 風險登記

| # | 風險 | 影響 | 可能性 | 緩解 |
|---|---|---|---|---|
| R1 | `react-native-audio-api` 擷取格式／重取樣品質不符 16 kHz PCM16 需求 | 語音功能無法上線 | 中 | Phase 0 spike；備案：自寫 Expo native module（Swift AVAudioEngine／Kotlin AudioRecord） |
| R2 | maplibre-react-native 3D 交叉淡化或 7.9k 點分群效能不足 | 地圖體驗降級 | 中 | Phase 0 spike；備案：3D 切換改為無動畫、按縮放層級分批載入設施 |
| R3 | 背景定位審查被退 | 延後上架 | 中 | 只在導航與 SOS 進行中啟用；權限說明與審查備註事先準備；提供不需背景權限也能用的前景模式 |
| R4 | 後端 B-01～B-04 排程延誤 | 登入與 SOS 卡住 | 中 | Phase 0 就提出並排入後端；Phase 1–2 以匿名可用功能為主 |
| R5 | 與 Web repo 邏輯漂移（API 契約變更只改一邊） | 隱性錯誤 | 高 | `docs/port-ledger.md`（§13）；後端 migration 文件出新版時兩邊都要列入待辦 |
| R6 | `expo/fetch` 串流在 SDK 57 取消語意或穩定性問題 | AI 串流／SOS 更新異常 | 低 | spike；備案 `react-native-sse` |
| R7 | zh-TW TTS 語音在部分 Android 裝置缺失 | 導航播報失效 | 低 | 啟動檢查＋提示安裝語音包；以震動＋畫面提示降級 |
| R9 | 未付 Apple Developer 年費（使用者決定上架延後） | 無法 TestFlight；免費帳號真機簽章 7 天失效，且**不支援 Sign in with Apple、推播**等 capability，Phase 3 這兩項在 iOS 真機無法驗證 | 高 | Android 真機可免費側載 APK，語音與背景定位的真機驗證先在 Android 做；iOS 真機驗證集中到繳費後一次補做；ROADMAP 各期出口條件中的「送 TestFlight」改為「可在模擬器與 Android 真機安裝」 |
| R8 | Bundle ID 與 Capacitor 版不同 | 若 Capacitor 版已上架，舊用戶不會自動遷移 | 待確認 | §14 Q1 |

---

## 13. 與 Web repo 的同步機制

建立 `docs/port-ledger.md`，每個移植模組一列：

| 本 repo 路徑 | Web 來源 | 來源 commit | 移植日期 | 差異說明 |
|---|---|---|---|---|
| `src/features/auth/domain/authRefresh.ts` | `src/lib/authRefresh.ts` | `5eadc71` | YYYY-MM-DD | `.then` 改 async/await；以 AuthPort 取代 configureAuthState |

同步檢查：在 Web repo 執行 `git diff <來源 commit>..main -- <Web 來源路徑>`，有差異就評估是否要跟進，跟進後更新 commit 欄位。後端 `docs/FRONTEND_MIGRATION_*.md` 新增或改版時，視為兩端共同待辦。

---

## 14. 未決問題

| # | 問題 | 影響 | 建議 |
|---|---|---|---|
| Q1 | Capacitor 版是否已上架？ | 決定是否要沿用 `com.accessiblemap.app` 以承接舊用戶 | 未上架則維持 `dev.yuzen.accessiblesmartmap` |
| Q2 | 正式 API 主機名稱？ | `EXPO_PUBLIC_END_POINT` | 向部署負責人確認（B-07） |
| Q3 | 收藏地點要不要上雲端同步？ | 後端目前無 API，v1 只存本機 | v1 本機；v2 評估 |
| Q4 | 語音導航是否需要背景播放（`UIBackgroundModes: audio`）？ | 審查與電量 | v1 只做本機 TTS 背景播報，語音助理限前景 |
| Q5 | 是否支援平板與橫向？ | 版面工作量 | v1 直向手機，確保 iPad 可用但不最佳化 |
| Q6 | 推播用 Expo Push Service 是否符合隱私政策？ | 推播資料經第三方 | v1 採用並在隱私權政策揭露 |
