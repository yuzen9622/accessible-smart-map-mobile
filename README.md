# 無障礙智慧地圖（accessible-smart-map-mobile）

<div align="center">

![Expo](https://img.shields.io/badge/Expo-SDK_57-000020?style=flat-square&logo=expo&logoColor=white)
![React Native](https://img.shields.io/badge/React_Native-0.86-61DAFB?style=flat-square&logo=react&logoColor=black)

![Expo Router](https://img.shields.io/badge/Expo_Router-v57-000020?style=flat-square&logo=expo&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-Strict_6.0-3178C6?style=flat-square&logo=typescript&logoColor=white)
![MapLibre Native](https://img.shields.io/badge/MapLibre_Native-11.4-008080?style=flat-square&logo=maplibre&logoColor=white)

![iOS](https://img.shields.io/badge/iOS-17.0+-000000?style=flat-square&logo=apple&logoColor=white)
![Android](https://img.shields.io/badge/Android-API_26+-34A853?style=flat-square&logo=android&logoColor=white)
![Jest](https://img.shields.io/badge/Jest-29.7-C21325?style=flat-square&logo=jest&logoColor=white)



![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)

專為臺北都會區打造的原生無障礙導航與即時大眾運輸輔助應用程式。

[系統概覽](#系統概覽) · [核心功能](#核心功能) · [系統架構與設計](#系統架構與設計) · [快速開始](#快速開始) · [常用指令](#常用指令) · [工程規範與品質驗證](#工程規範與品質驗證) · [相關文件](#相關文件)

</div>

---

## 系統概覽

**現況痛點**：既有主流地圖與導航服務多針對一般步行或車行路徑設計，缺乏完整的無障礙設施資料維度（如捷運無障礙電梯、無障礙出入口、無障礙廁所與專用停車位），亦無法在規劃路徑時主動避開階梯與陡坡，造成輪椅使用者、推嬰兒車家長與行動不便族群在城市移動中頻繁遭遇通行障礙。

**解決方案**：本專案「無障礙智慧地圖」為 Web 版的原生行動端復刻，基於 Expo SDK 57、React Native 與 MapLibre Native，深度串接 TDX 交通部開放資料與無障礙點位，打造兼顧高效能與平台原生體驗的 iOS 與 Android 雙平台應用程式。具備背景定位即時轉向導航、鎖定畫面動態提示（iOS Live Activities）、原生向量圖層分群渲染與雙向低延遲語音串流助理。

**預期成果**：提供具備同步高效能狀態儲存（MMKV）、系統層級 VoiceOver / TalkBack 無障礙語意、低延遲 PCM 語音互動與背景常駐導航的現代化無障礙行動解決方案。

---

## 核心功能

- **無障礙設施與空間探索**：完整收錄捷運電梯、無障礙廁所、友善坡道出入口及無障礙停車格，由 MapLibre 原生向量圖層支援高速分群（Clustering）與 3D 建築體積渲染。
- **無障礙路徑規劃與轉向導航**：支援輪椅、平緩步行與一般多運具規劃；具備轉向提示播報，並在使用者偏離路徑時由本機與後端協同觸發即時重新規劃（Reroute）。
- **背景常駐導航與鎖定畫面動態**：整合 iOS Live Activities（透過 expo-widgets）與 Android 常駐通知，在鎖定畫面及多工切換時持續提供下一步行進引導。
- **即時公車動態追蹤**：串接 TDX 交通部雙北公車即時開放資料，動態呈現公車站牌、預估到站時間及低地板無障礙公車行駛狀態。
- **低延遲語音與 AI 助理**：基於 react-native-audio-api 實現 16kHz Float32 PCM 即時音訊擷取與 24kHz 串流排程佇列播放，具備自然對話、中途打斷機制與地圖動作聯動。
- **緊急求助（SOS）與路況危險通報**：支援一鍵啟動緊急求助狀態並持續上報即時坐標；提供相機拍照上傳回報道路施工、路面破損等無障礙阻礙事件。
- **無障礙與原生適配**：採用 Lucide 向量幾何圖示統一雙平台視覺語言，全面支援 Dynamic Type 動態字級縮放、高對比主題、iOS 原生 formSheet 與 Liquid Glass 毛玻璃視覺效果。

---

## 系統架構與設計

專案採用 Feature-based 模組化分層架構，所有領域功能均落於獨立模組中，嚴格維持單向依賴。

```text
src/
├── app/                  # Expo Router 路由定義與畫面組裝
├── features/             # 業務功能領域模組
│   ├── auth/             # 身份認證（Apple、Google、Email）與權杖更新
│   ├── bus/              # 即時公車查詢、路線站牌與到站動態
│   ├── hazard/           # 障礙與危險事件通報、照片拍攝
│   ├── home/             # 首頁地圖面板與探索視圖
│   ├── map/              # 地圖核心控制器、圖層樣式與設施圖標
│   ├── navigation/       # 導航引擎、轉向語音提示與動態重新規劃
│   ├── notifications/    # 推播通知與裝置註冊
│   ├── onboarding/       # 新手引導與個人化無障礙偏好設定
│   ├── place/            # 地點搜尋、周邊無障礙設施與空間詳情
│   ├── route/            # 無障礙路徑計算、多運具規劃
│   ├── settings/         # 系統設定、字級縮放與外觀主題
│   └── sos/              # 緊急求助廣播與常駐定位追蹤
└── shared/               # 跨領域共用基礎設施（API、Storage、Theme、Location 等）
```

---

## 快速開始

### 環境需求

- Node.js &gt;= 20.x
- npm &gt;= 10.x
- macOS（建置 iOS 應用必備，需具備 Xcode 16+ 與 CocoaPods）
- Android Studio 與 Android SDK（建置 Android 應用必備）

### 安裝步驟

1. **取得程式碼**：
   ```bash
    git clone https://github.com/accessible-smart-map/accessible-smart-map-mobile.git
    cd accessible-smart-map-mobile
   ```
2. **安裝依賴套件**：
   ```bash
    npm install
   ```
3. **設定環境變數**：
 複製設定範本並填入對應的 API 端點：
   ```bash
    cp .env.example .env.local
   ```

    設定項說明：
   - `EXPO_PUBLIC_END_POINT`：後端服務 API 基底網址（預設 `https://map.yuzen.dev`）
   - `EXPO_PUBLIC_SHARE_BASE_URL`：地點與路線分享基礎網址
   - `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`：Google 登入 Web 用戶端 ID
   - `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`：Google 登入 iOS 用戶端 ID
   - `EXPO_PUBLIC_PRIVACY_POLICY_URL`／`EXPO_PUBLIC_TERMS_URL`：隱私權政策／服務條款網址（https；留空時設定頁不顯示入口）

   版控中的 `.env` 只放公開的正式環境預設值，EAS Build／Update 會讀到它；`.env.local` 會覆蓋 `.env`。Google client ID 屬環境設定，正式 build 需另外以 EAS 環境變數提供（未設定時 Google 登入 plugin 不會加入）。
4. **啟動建置與執行**：

   由於本專案包含 MapLibre Native、Audio API 與 MMKV 等 C++/原生模組，無法直接於 Expo Go 中運行，請使用 Development Build：

    **iOS 模擬器**：
    ```bash
    npx expo run:ios
    ```

    **Android 模擬器**：
    ```bash
    npx expo run:android
    ```

    **本機 Metro 伺服器**（原生建置完成後）：
    ```bash
    npm run start
    ```

---

## 真機安裝與 OTA 更新（iOS）

裝到自己的 iPhone 有兩種情境：有付費 Apple Developer Program 的帳號用 EAS Build；只有免費 Apple ID（Personal Team）時，只能在 Mac 上本機建置並以 USB 安裝。兩種都能透過 EAS Update 推送 JS 更新（OTA），不必每次重裝。

### 免費 Apple ID：本機建置安裝

免費帳號無法簽署推播、Sign in with Apple 與 App Groups 這三種能力。設定 `IOS_FREE_SIGNING=1` 時，`app.config.ts` 會暫時拿掉 `expo-notifications`、`expo-apple-authentication`、`expo-widgets` 三個 plugin，並由 `plugins/with-free-signing.ts` 清除相關 entitlement。因此這種 build **沒有遠端推播、Apple 登入與 Widget／Live Activity**；EAS 與正式 build 不設此變數，不受影響。

1. **找出 Team ID 與裝置 UDID**：Team ID 是鑰匙圈中 Apple Development 憑證的 `OU` 欄位；UDID 由 `devicectl` 列出。
   ```bash
   security find-certificate -c "Apple Development" -p | openssl x509 -noout -subject
   xcrun devicectl list devices
   ```
2. **以免費簽章模式產生原生專案**：
   ```bash
   IOS_FREE_SIGNING=1 npx expo prebuild --platform ios --clean
   ```
3. **建置 Release 版**（`DEVELOPMENT_TEAM` 每次 prebuild 後都會遺失，請在命令列帶入）：
   ```bash
   IOS_FREE_SIGNING=1 xcodebuild -workspace ios/app.xcworkspace -scheme app \
     -configuration Release -destination 'generic/platform=iOS' \
     -derivedDataPath ios/build/device -allowProvisioningUpdates \
     DEVELOPMENT_TEAM=<TEAM_ID> CODE_SIGN_STYLE=Automatic
   ```
4. **以 USB 安裝到 iPhone**：
   ```bash
   xcrun devicectl device install app --device <UDID> \
     ios/build/device/Build/Products/Release-iphoneos/app.app
   ```

> [!NOTE]
> - 免費簽章的 App **7 天後過期**，到期需重新執行步驟 3–4。
> - 若建置出現 provisioning profile 或帳號登入錯誤，請到 Xcode › Settings › Accounts 重新登入該 Apple ID。
> - CocoaPods 需要 UTF-8 locale；若 shell 為 `LANG=C`，請在指令前加上 `LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8`。

### 付費 Apple Developer：EAS Build

```bash
npx eas-cli@latest build --profile preview --platform ios
```

`eas.json` 的 `preview` profile 會將 build 綁定到 `preview` channel。

### 推送 OTA 更新（EAS Update）

`app.json` 的 `updates.requestHeaders` 已將本機 build 綁定到 `preview` channel，`runtimeVersion` 採 `fingerprint` 策略。SDK 57 發布必須指定 `--environment preview`；此時使用 EAS 雲端變數，**不讀本機 `.env`／`.env.local`，也不套用 `eas.json` build profile 的 `env`**。

先在專案的 EAS `preview` environment 設定 `EXPO_PUBLIC_END_POINT` 與 `EXPO_PUBLIC_SHARE_BASE_URL`（目前皆為 `https://map.yuzen.dev`），並確認 Google 登入的兩個 client ID 已存在。隱私權政策與服務條款網址是選填，未設定時不顯示入口。不得只以 export 成功判定設定完整。

只改 JS／資源時，先用雲端變數執行 App 的設定驗證，通過後才發布（檢查腳本使用 Node 的 TypeScript type stripping，需 Node 22.18+）：

```bash
npx eas-cli@latest env:exec preview 'node --experimental-strip-types scripts/check-update-env.mjs' --non-interactive && \
IOS_FREE_SIGNING=1 npx eas-cli@latest update --channel preview --environment preview --platform ios --message "說明這次更新"
```

- **`IOS_FREE_SIGNING=1` 必須與建置時一致**：它會改變 app config，進而改變 fingerprint；不一致時手機會判定 runtime 不相容而不套用更新。EAS Build 的 build 則不要帶這個變數。
- **加上 `--platform ios`**：`--platform all` 會連同 web 靜態渲染一起匯出，而原生元件在 web 端會失敗。
- **使用 `npx eas-cli@latest`**：`eas.json` 要求 eas-cli ≥ 24.0.0，舊版全域安裝會被拒絕。
- 推送後在手機上**完全關閉 App 再開啟兩次**：第一次下載更新，第二次才會套用。
- 新增原生套件、修改原生設定或 config plugin 會改變 fingerprint，這時 OTA 無法套用，必須重新建置安裝。發佈前可用 `npx eas-cli@latest fingerprint:compare` 確認。

---

## 常用指令


| 指令                         | 說明                                      |
| -------------------------- | --------------------------------------- |
| `npm run start`            | 啟動 Expo Metro 本機開發伺服器                   |
| `npm run ios`              | 建置 iOS 原生專案並於模擬器啟動應用程式                  |
| `npm run android`          | 建置 Android 原生專案並於模擬器啟動應用程式              |
| `npm run lint`             | 執行 ESLint 靜態檢查（套用 Flat Config，執行零警告規範）  |
| `npm run typecheck`        | 執行 TypeScript 型別檢查（驗證 app 與 plugins 專案） |
| `npm test`                 | 執行全套 Jest 單元測試與領域邏輯測試                   |
| `npm run test:watch`       | 以監聽模式執行 Jest 測試                         |
| `npx expo-doctor`          | 執行 Expo 專案健康檢查與套件版本相容性診斷                |
| `npx expo install --check` | 驗證已安裝套件版本是否符合 Expo SDK 57 標準規格          |


---

## 工程規範與品質驗證

- **零 `any` 與型別嚴格要求**：專案全面啟用 TypeScript Strict 模式，嚴禁使用 `any`、隱式 any 或型別斷言迴避；禁止使用 `// @ts-ignore`、`// @ts-expect-error` 或 `eslint-disable` 遮蔽問題。
- **現代語意語法**：非同步流程一律採用 `async` / `await` 與標準 `try...catch` 錯誤處理架構，禁止使用舊式 `.then()` / `.catch()` 鏈式呼叫。
- **品質驗收基準**：任何功能提交或 Pull Request 前，以下檢查項目必須全數無錯誤通過：
  1. `npm run typecheck`：零型別錯誤。
  2. `npm run lint`：零警告、零錯誤。
  3. `npm test`：全數測試通過（114 個測試套件，1069 個測試案例）。

---

## 授權條款

本專案採用 [MIT License](./LICENSE) 授權。
