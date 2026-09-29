# accessible-smart-map-mobile

臺北無障礙導航系統（Accessible Smart Map）原生雙平台行動應用程式，專為輪椅使用者、推嬰兒車家長、高齡長者、視障朋友及行動不便者設計。

本專案將 Web 版「臺北無障礙導航系統」（線上版：https://map.yuzen.dev/）完整復刻並升級為原生 iOS 與 Android 應用程式。架構基於 Expo SDK 57、React Native 0.86（New Architecture）與 React 19，提供高流暢度的向量地圖、無障礙路徑規劃、背景即時導航、即時公車動態、緊急求助（SOS）以及路況障礙通報等完整功能。

## 目錄

- 專案特色
- 核心功能模組
- 系統架構與設計原則
- 技術棧
- 專案目錄結構
- 環境變數設定
- 開發與建置指南
- 測試與代碼品質
- 相關技術文件
- 授權條款

## 專案特色

- 專屬無障礙路網演算法：提供無階梯、坡度適應、電梯優先、路面平整度考量等個人化步行與大眾運輸路徑規劃。
- 高效能原生向量圖資：採用 MapLibre 原生渲染引擎，流暢呈現超過 7,000 筆無障礙設施資料點位與叢集。
- 背景導航與即時動態：支援系統背景持續定位導航、語音轉向指引，並深度整合 iOS 鎖定畫面即時動態（Live Activities）與動態島（Dynamic Island）。
- 離線優先與安全儲存：關鍵地點收藏與離線快取採用 MMKV 高速鍵值儲存，敏感憑證採用 SecureStore 加密保存。
- 雙平台原生深度適配：遵循 iOS Human Interface Guidelines 與 Android Material Design 慣例，支援系統級 Dynamic Type 字級縮放、高對比度佈景主題與降低動態效果模式。

## 核心功能模組

### 1. 無障礙地圖與設施可視化
- 原生向量底圖：支援淺色、深色與高對比地圖樣式，可平滑切換 2D 平面與 3D 建物透視圖層。
- 設施圖資整合：即時展示捷運無障礙電梯、無障礙出入口、無障礙廁所、親子廁所等詳細圖層與原生叢集（Clustering）。
- 停車位資訊：提供身心障礙專用停車格與即時停車位圖層。
- 視圖連動：地圖中心與視野範圍自動隨底層抽屜（FormSheet）滑動高度動態調整視角內縮（Inset）。

### 2. 智慧地點搜尋與無障礙評估
- 快速搜尋：整合自動完成（Autocomplete）、熱門景點、歷史搜尋紀錄與座標/地址反查。
- 無障礙屬性檢視：地點具備三態無障礙評估（無障礙、部分無障礙、不具備無障礙）與詳細設施檢核表。
- 在地評價與 AI 摘要：社群無障礙結構化評分（坡度、通道、電梯等向度）與無障礙評論內容 AI 摘要。
- 地點收藏：本地收藏地點管理，支援自訂標籤分類與資料結構版本遷移。

### 3. 無障礙路徑規劃
- 多運具模式：支援輪椅/無障礙步行、大眾運輸（捷運、公車、台鐵）與開車路徑規劃。
- 個人化偏好約束：可自訂避開樓梯、優先搭乘電梯、坡度限制、路面材質偏好與事故路段迴避。
- 路線資訊解析：分段路線卡片、轉乘運具指示、無障礙亮點分析、事故警示提示與純文字替代步驟列表。

### 4. 原生導航與即時指引
- NavigationHUD：清晰展示當前轉向箭頭、剩餘距離、剩餘時間、路段進度與跨運具交接卡片。
- 偏航偵測與自動重新規劃：當偏離既定路線時自動發起即時重新路徑計算（Reroute）。
- 語音與觸覺反饋：整合系統語音合成（TTS）轉向播報、觸覺震動回饋與導航期間螢幕常亮（Keep Awake）。
- 背景持續定位：支援系統背景位置追蹤（iOS UIBackgroundModes location 與 Android 前景服務），切換應用程式或鎖定螢幕不中斷導航。
- iOS Live Activities 與動態島：透過 expo-widgets 於鎖定畫面與動態島即時更新下一步轉向與距離。

### 5. 公車即時動態
- 交通開放資料串接：整合 TDX 公車即時資料，提供全台路線搜尋、方向切換與站牌查詢。
- 到站預估時間（ETA）：即時顯示公車預估到站時間與行駛狀態。
- 即時公車位置圖層：在地圖上以高幀率平滑內插呈現公車移動位置與無障礙低地板公車標記。

### 6. 緊急求助（SOS）與路況障礙通報
- 緊急求助（SOS）機制：防誤觸大型觸控按鈕、求助狀態快照、即時 SSE 事件流、震動提醒與即時推播通知。
- 家人追蹤與救援導航：產生安全分享追蹤連結，家人端可直接於 App 內一鍵發起導航前往求助者即時座標。
- 路況障礙即時通報：針對臨時施工、電梯故障、道路受阻等突發障礙提供相片拍攝、圖片壓縮上傳與附近通報展示。

### 7. 帳號體系與需求輪廓同步
- 多元身分認證：支援 Email 註冊登入、Google 登入與 Apple 登入（iOS）。
- 無感 Token 輪替：安全儲存 Token 於 SecureStore，支援 401 逾期自動續期與請求並發防護。
- 個人無障礙輪廓（A11y Profile）：個人行動輔具偏好設定（輪椅、電動代步車、推車、視力輔助）雲端同步。

## 系統架構與設計原則

本專案採 Feature-based 架構設計，並維持「API Client -> Controller / Store / Hook -> UI」的單向依賴原則：

- 業務領域高內聚：業務功能獨立封裝在 `src/features/<feature>/` 目錄下（包含 domain、components、hooks、api、store 與 types），外部僅能透過 `index.ts` 匯出的介面進行調用，禁止跨 feature 內部檔案直接引用。
- 平台元件三檔分離慣例（Three-File Component Pattern）：
  為兼顧跨平台共用性與各平台原生細節，UI 元件依循以下檔案結構：
  - `Foo.types.ts`：定義元件 Props 與共用型別介面。
  - `Foo.tsx`：Fallback 實作（提供 Web 端或 TypeScript 預設型別推導）。
  - `Foo.ios.tsx`：針對 iOS 平臺特化的原生實作（如使用 `@expo/ui` 或 iOS 專屬視覺效果）。
  - `Foo.android.tsx`：針對 Android 平臺特化的原生實作。
- 嚴格型別原則：全專案啟用 TypeScript Strict 模式，全面禁止使用 `any`、禁止使用 `@ts-ignore` 等註解規避型別檢查，由 ESLint 機械化守門。
- 狀態與儲存分層：全域商業狀態採用 Zustand，本地持久化採用 MMKV，敏感認證資訊採用 Expo SecureStore。

## 技術棧

### 核心運行環境
- React Native 0.86.3 (New Architecture)
- React 19.2.3
- Expo SDK 57 (~57.0.25)
- Expo Router (~57.0.23) 檔案型路由，啟用 typedRoutes
- TypeScript 6.0+

### 地圖與圖資
- @maplibre/maplibre-react-native 11.4.0
- MapLibre GL 向量樣式與 GeoJSON 原生叢集

### 介面與動效
- @expo/ui (~57.0.20) 原生組件
- react-native-reanimated 4.5.1
- react-native-gesture-handler (~2.32.0)
- lucide-react-native 統一圖示系統
- expo-glass-effect 與 expo-symbols

### 系統原生能力
- expo-widgets (iOS Live Activities & Dynamic Island)
- expo-location 與 expo-task-manager (前景與背景持續定位)
- expo-speech (語音導航播報)
- expo-haptics (觸覺震動回饋)
- expo-keep-awake (螢幕常亮控制)
- expo-notifications (即時推播通知)
- expo-image-picker 與 expo-image-manipulator (通報相片選取與壓縮)
- expo-secure-store 與 react-native-mmkv (加密憑證與高速本地儲存)
- expo-apple-authentication 與 @react-native-google-signin/google-signin (第三方登入)
- react-native-audio-api (低延遲音訊擷取與播放)

### 測試框架
- Jest 29 與 jest-expo
- @testing-library/react-native

## 專案目錄結構

```text
accessible-smart-map-mobile/
├── app.config.ts            # Expo 動態組態設定
├── app.json                 # Expo 靜態組態、權限與 Plugin 設定
├── assets/                  # 應用程式靜態資源（圖示、字型、啟動圖）
├── docs/                    # 系統架構文件、分期計畫與驗證記錄
│   ├── SDD.md               # 系統設計文件 (System Design Document)
│   ├── ROADMAP.md           # 分期實作進度路線圖
│   ├── port-ledger.md       # Web 版代碼移植帳本
│   └── spikes/              # 地圖、語音、Sheet 等技術調研報告
├── plugins/                 # 本地 Expo Config Plugins (TypeScript)
│   └── with-ios-scene-lifecycle.ts
├── src/
│   ├── app/                 # Expo Router 路由與畫面組裝入口
│   │   ├── _layout.tsx      # 全域根佈局（主題、語系、組態檢查）
│   │   ├── index.tsx        # 主地圖畫面
│   │   ├── (sheet)/         # 常駐底部抽屜 FormSheet 堆疊路由
│   │   │   ├── plan.tsx     # 路線規劃面板
│   │   │   ├── bus/         # 公車查詢與到站動態面板
│   │   │   ├── routes/      # 路線詳情與步驟列表
│   │   │   └── navigation.tsx # 即時導航面板
│   │   ├── auth.tsx         # 登入與會員認證
│   │   ├── sos.tsx          # 緊急求助畫面
│   │   ├── hazard-report.tsx# 路況障礙回報
│   │   └── settings/        # 設定頁面群
│   ├── features/            # Feature-based 業務模組
│   │   ├── auth/            # 認證與帳號安全
│   │   ├── bus/             # 即時公車查詢與追蹤
│   │   ├── hazard/          # 障礙通報管理
│   │   ├── map/             # 地圖控制器、圖層渲染與相機操作
│   │   ├── navigation/      # 導航引擎、偏航重算、HUD 與 Live Activities
│   │   ├── notifications/   # 推播處理與權限管理
│   │   ├── onboarding/      # 新手引導與個人需求輪廓配置
│   │   ├── place/           # 地點搜尋、詳情、評論與收藏
│   │   ├── route/           # 路線規劃、運具模式與路網請求
│   │   ├── settings/        # 偏好設定、高對比、字級與語系
│   │   └── sos/             # SOS 求助歷程與救援追蹤
│   └── shared/              # 跨 Feature 共用基礎層
│       ├── api/             # 統一 HTTP Fetch Client、錯誤處理與 SSE 解析
│       ├── config/          # 環境變數安全驗證與組態錯誤回報
│       ├── geo/             # 地理幾何演算法與座標運算
│       ├── i18n/            # 多語系配置（zh-TW / en）
│       ├── location/        # 原生定位連接埠（前景與背景服務）
│       ├── storage/         # MMKV 與 SecureStore 抽象介面
│       ├── theme/           # 顏色語意、字級與高對比 Tokens
│       └── ui/              # 跨平臺通用原生 UI 組件庫
└── tsconfig.json            # TypeScript 編譯組態
```

## 環境變數設定

本專案使用 Expo 內建的環境變數機制。所有設定值會於建置期嵌入 App Bundle，請勿在其中放置私人機密金鑰。

複製範例設定檔建立本地環境變數：

```bash
cp .env.example .env.local
```

### 變數清單說明

| 變數名稱 | 必填 | 說明與預設值 |
| --- | --- | --- |
| `EXPO_PUBLIC_END_POINT` | 是 | 後端 API 服務端點 URL（正式環境預設為 `https://map.yuzen.dev`，開發環境為 `https://map-dev.yuzen.dev`） |
| `EXPO_PUBLIC_SHARE_BASE_URL` | 是 | 地點與路線分享連結的根網域（例如：`https://map.yuzen.dev`） |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | 否 | Google 登入 Web Client ID（使用 Google 登入功能時配置） |
| `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` | 否 | Google 登入 iOS Client ID（使用 Google 登入功能時配置） |

當環境變數遺漏或格式不合法時，應用程式會在啟動階段直接顯示設定錯誤畫面，防止未定義行為。

## 開發與建置指南

### 前置條件

- Node.js >= 20.0.0
- npm >= 10.0.0
- macOS 開發環境（若需編譯與執行 iOS 應用程式）
- Xcode >= 16.0 及 CocoaPods（iOS 開發）
- Android Studio 與 Android SDK（Android 開發）

### 1. 安裝套件依賴

請使用 npm 安裝既有依賴項：

```bash
npm install
```

如需新增或更新套件，必須使用 Expo CLI 工具以確保安裝與 SDK 57 相容之版本：

```bash
npx expo install <package-name>
```

### 2. 本地開發與原生建置（Development Build）

本專案包含多項原生原生模組（MapLibre、Audio API、Live Activities、背景定位等）及本地 Config Plugins，**無法在標準 Expo Go 容器中執行**，必須使用 Development Build。

#### 啟動 iOS 模擬器開發建置

在 macOS 上執行 CocoaPods 相關建置時，請確保終端環境採用 UTF-8 編碼：

```bash
LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 npx expo run:ios
```

#### 啟動 Android 開發建置

```bash
npx expo run:android
```

#### 啟動 Metro 開發伺服器

當原生專案已建置於模擬器或實體裝置上後，可直接啟動 Metro 伺服器進行熱重載開發：

```bash
npm run start
```

### 3. iOS 27 Scene Lifecycle 說明

針對 iOS 27 SDK 規範的強制 UIScene Lifecycle，本專案在 `plugins/with-ios-scene-lifecycle.ts` 內建客製化 Config Plugin，確保在 Expo Prebuild 時正確配置 `SceneDelegate` 與 `ExpoReactNativeFactoryProvider`。

原生設定或外掛若有更動，請執行清理重新生成：

```bash
npx expo prebuild --platform ios --clean
```

### 4. 導航 GPS 模擬測試

在 iOS 模擬器中，可利用 `simctl` 模擬使用者沿路線前進，驗證轉向指引與偏航重新計算：

```bash
xcrun simctl location booted start --speed=3 <緯度1,經度1> <緯度2,經度2> ...
```

結束位置模擬：

```bash
xcrun simctl location booted stop
```

## 測試與代碼品質

在提交任何代碼前，請確認以下所有品質檢驗命令皆為零錯誤與零警告：

### 執行型別檢查

檢查應用程式主體與本地 Plugins 的 TypeScript 型別：

```bash
npm run typecheck
```

### 執行 ESLint 靜態代碼分析

本專案採用嚴格 ESLint Flat Config，嚴格禁止 `any` 型別與各類行內註解規避：

```bash
npm run lint
```

### 執行單元與整合測試

使用 Jest 執行完整測試套件（涵蓋演算法、資料流、狀態控制器與轉換層）：

```bash
npm test
```

單元測試即時監聽模式：

```bash
npm run test:watch
```

### 專案健全狀態診斷

使用 Expo Doctor 檢查專案依賴相容性與組態正確性：

```bash
npx expo-doctor
```

## 相關技術文件

- 系統設計文件（SDD）：請參閱 `docs/SDD.md`，詳述系統架構、架構決策紀錄（ADR）、各模組規格與無障礙設計規範。
- 分期實作路線圖：請參閱 `docs/ROADMAP.md`，了解各階段里程碑交付物與開發狀態。
- 代碼移植紀錄：請參閱 `docs/port-ledger.md`，追蹤自 Web 版移植之函式庫、演算法與單元測試來源對應。
- 技術調研評估（Spikes）：請參閱 `docs/spikes/`，內含地圖圖資（MapLibre）、音訊語音串流、底層抽屜（Sheet）等關鍵架構評估結果。

## 授權條款

本專案採用 MIT License 授權條款，詳情請參閱專案根目錄之 [LICENSE](LICENSE) 檔案。
