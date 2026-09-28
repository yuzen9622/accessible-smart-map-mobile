# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## 專案目標

把 Web 版「臺北無障礙導航系統」（參考專案：`/Users/yuen/orca/taipei-accessible-map`，線上版 https://map.yuzen.dev/） **復刻成原生 iOS／Android App**。功能對齊參考專案；UI 與互動改用原生慣例，不要照搬 DOM／CSS。

- 參考專案有 graphify 圖譜：先讀 `/Users/yuen/orca/taipei-accessible-map/graphify-out/wiki/index.md` 與 `graphify-out/GRAPH_REPORT.md`，再決定是否讀原始檔。
- 後端沿用參考專案的 Node.js + Express API（串 TDX 交通開放資料）。Web 端 base URL 來自 `NEXT_PUBLIC_END_POINT`；本專案改用 `EXPO_PUBLIC_*` 環境變數。
- 參考專案的主要功能模組（移植時的 feature 邊界參考）：地圖與無障礙設施點位（捷運電梯、無障礙出入口、廁所）、地點搜尋與詳情／評論、路線規劃與導航（含重新規劃路線 reroute）、公車即時動態與到站時間、AI 聊天／語音助理、SOS／緊急聯絡、危險通報、認證（含 token refresh）、設定（字級、色彩主題、語系 `zh-TW`／`en`）、Onboarding。
- 參考專案的分層：`src/lib/api/*`（API client，每個領域一檔）、`src/lib/fetch.ts`（統一 request、`ApiError`、401 refresh-retry）、`src/stores/*`（zustand）、`src/hook/*`、`src/i18n/locale/*`。移植時保留這個「API client → store／hook → UI」單向依賴。

## 技術棧（固定版本）

- Expo SDK 57、React Native 0.86、React 19.2、Expo Router、TypeScript（strict）。
- 升級或新增套件一律用 `npx expo install <pkg>`，讓版本對齊 SDK 57，不要直接 `npm install` 指定版本。

## 常用指令

```bash
npm run start             # expo start，啟動 dev server
npx expo run:ios          # 產生 ios/ 並建置到 iOS 模擬器（加原生模組後必須用 dev build，不能用 Expo Go）
npx expo run:android      # 同上，Android
npm run lint              # expo lint（ESLint flat config：eslint.config.js）
npm run typecheck         # tsc：app（tsconfig.json）+ plugins（plugins/tsconfig.json，含 Node types）
npx expo install --check  # 檢查套件版本是否符合 SDK 57
npx expo-doctor           # 專案健康檢查
```

- `ios/`、`android/` 由 CNG 產生且已 gitignore，不要手改；原生設定走 `app.json` 與 config plugin（本地 plugin 放 `plugins/`，用 TypeScript 寫）。原生設定變更後用 `npx expo prebuild --platform ios --clean` 重新產生。
- **iOS 27 SDK 強制 UIScene life cycle**，而 SDK 57 的 prebuild 模板沒有採用（App 會停在 splash 並在 log 印 `UIScene life cycle is required`）。`plugins/with-ios-scene-lifecycle.ts` 把 SDK 58 模板的做法（`SceneDelegate: ExpoAppSceneDelegate` + Info.plist `UIApplicationSceneManifest` + AppDelegate 改 conform `ExpoReactNativeFactoryProvider`）移植過來；升到 SDK 58 後應移除此 plugin。要改 AppDelegate 的其他 plugin 須與它相容（它會在找不到預期程式碼時直接 throw）。
- CocoaPods 需要 UTF-8 locale：shell 若是 `LANG=C`，`pod install` 會報 `Unicode Normalization not appropriate for ASCII-8BIT`。執行 `expo run:ios`／`prebuild` 前加 `LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8`。
- Bundle ID／Android package：`com.accessiblemap.app`（沿用 Web 版 Capacitor 的 ID；Capacitor 版未上架、將棄用）；`app.json` 已開 `typedRoutes` 與 `reactCompiler`（React Compiler 已自動 memo，不要手動到處加 `useMemo`/`useCallback`）。

## 驗證

- **所有驗證都要開 iOS 模擬器實跑**：用 iOS Simulator 工具先 `attach` 開啟面板，再 `npx expo run:ios`（或 dev server 已在跑時直接 reload），以截圖／點擊確認畫面與行為。型別檢查通過不等於驗證完成。
- 交付前 `npm run typecheck` 與 `npm run lint` 必須零錯誤零警告。

## 撰寫規範

### 必須參考 Expo Skills

任何程式碼撰寫都要先查 Expo Skills（https://docs.expo.dev/skills/）對應主題的官方最佳做法；Web → Native 的對應（DOM、CSS、React Router、localStorage、window 等）用 `expo-web-to-native` skill。遇到版本相關 API，以 SDK 57 文件為準，不要憑記憶。

### 型別嚴格化

- 禁止 `any`（含隱式 any、`as any`、`any[]`）。
- 禁止用註解規避型別或 lint 警告：不得出現 `// @ts-ignore`、`// @ts-expect-error`、`// @ts-nocheck`、`eslint-disable` / `biome-ignore` 等。
- `eslint.config.js` 以 `@typescript-eslint/no-explicit-any`、`ban-ts-comment` 與 `linterOptions.noInlineConfig` 機械化執行上兩條；不得為了過 lint 而放寬這些設定。
- 型別不確定時用 `unknown` 搭配 type guard／schema 驗證收窄；API 回應要有明確型別（參考專案 `src/types/response.d.ts` 的 `ApiResponse` 形狀）。

### 現代寫法

- 非同步一律 `async`/`await` + `try`/`catch`，不要用 `.then()` / `.catch()` 串接。
- 選用當前最佳做法（React 19 與 Expo Router 的慣用 API），不要沿用已被取代的舊模式。

### 專案架構：feature-based + 解耦

目錄：`src/app/`（路由）、`src/features/<feature>/`、`src/shared/`（跨 feature 共用，如 `shared/theme`）。path alias `@/*` → `src/*`。`src/features/home` 是三檔元件與 feature 公開出口的範例。

- 以 feature 為單位組織（例：`features/map`、`features/route`、`features/navigation`、`features/bus`、`features/place`、`features/auth`、`features/ai`、`features/sos`、`features/settings`），每個 feature 內自帶 components／hooks／api／store／types。
- `app/`（Expo Router）只放路由與畫面組裝，業務邏輯放在 feature 內。
- 跨 feature 共用的東西放共用層（例：`shared/`），feature 之間不要互相 import 內部檔案；每個 feature 以 `index.ts` 作為公開出口，外部（含 `src/app/` 路由檔）只從 `@/features/<feature>` 引用。
- 模組化、低耦合：API client、狀態、UI 分層，UI 不直接呼叫 fetch。

### 平台分檔：每個元件三個檔

同時支援 iOS 與 Android，元件拆成三個檔：

```
Foo.types.ts     # 共用 props 型別（三個實作都 import 這份）
Foo.tsx          # fallback 實作（web／TypeScript 型別解析用）
Foo.ios.tsx      # iOS 實作
Foo.android.tsx  # Android 實作
```

- Metro 依平台優先解析 `.ios.tsx`／`.android.tsx`，找不到才用 `.tsx`；TypeScript 則以 `Foo.tsx` 解析型別。因此 **props 型別與公開介面要定義在 `Foo.types.ts`**，兩個平台檔都實作同一份介面，確保型別一致。
- import 時一律寫 `./Foo`，不要帶平台副檔名。
