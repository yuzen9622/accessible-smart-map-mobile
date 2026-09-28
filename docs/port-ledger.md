# 移植帳本（Port Ledger）

每個自 Web 版移植的模組一列（SDD §13）。Web repo：`/Users/yuen/orca/taipei-accessible-map`。

同步檢查：在 Web repo 執行 `git diff <來源 commit>..main -- <Web 來源路徑>`，有差異就評估是否跟進，跟進後更新「來源 commit」。

| 本 repo 路徑 | Web 來源 | 來源 commit | 移植日期 | 差異說明 |
|---|---|---|---|---|
| `src/shared/i18n/locale/{zh-TW,en}/translation.json` | `src/i18n/locale/{zh-TW,en}/translation.json` | `5eadc71` | 2026-09-25 | 原樣複製 |
| `src/shared/i18n/index.ts`、`language.ts` | `src/i18n/client.ts`、`src/i18n/setting.ts` | `5eadc71` | 2026-09-25 | 移除 `[lng]` 路由 redirect 與 `useAuthStore` 依賴；語系改由 `expo-localization` 偵測（任何 `zh*` → zh-TW，其餘無符合 → zh-TW）；使用者自選語系待 settings |
| `src/shared/api/types.ts` | `src/types/response.d.ts` | `5eadc71` | 2026-09-25 | 型別逐字搬移；新增 `isApiResponse` type guard（Web 版無，本 repo 禁 `any` 需要在 `unknown` 上收窄） |
| `src/shared/api/fetch.ts` | `src/lib/fetch.ts` | `5eadc71` | 2026-09-25 | 401→refresh 一次→retry 一次、403 立即失效不 refresh、`skipAuthRetry`、205/`data: null` 視為成功等語意逐條保留；認證狀態改由注入的 `AuthPort`（`./auth-port.ts`）取代 Web 直接耦合的 `useAuthStore`／`authRefresh.ts`（single-flight 留給 Phase 3 `features/auth` 的 `AuthPort.refresh` 實作）；拿掉 `sonner` toast（`shared/api` 不依賴 UI 層，是否提示交由呼叫端）；新增「非 JSON 錯誤本文」容錯，合成等價 `ApiResponse` 信封而非讓 `response.json()` 的 SyntaxError 直接 reject（Web 版無此路徑，原生網路環境更容易遇到代理／閘道回傳非 JSON 錯誤頁）；base URL 改由 `getAppConfig().apiBaseUrl` 提供且可用 `options.baseUrl` 覆寫（Web 版由呼叫端自行組好完整 URL 傳入，本版兩種呼叫方式皆支援：完整 `http(s)://` URL 原樣使用，否則接上 base URL） |
| `src/shared/api/auth-port.ts` | `src/lib/authRefresh.ts`（僅介面設計參考，未移植 single-flight 實作） | `5eadc71` | 2026-09-25 | 新增檔案，非逐行移植：對應 SDD §4.3 `AuthPort`，把 Web `authRefresh.ts` 的 single-flight coordinator 與 `configureAuthState` 拆成注入介面；single-flight 本身與 compare-and-commit 的實際邏輯留給 Phase 3 `features/auth` 實作，本檔只提供匿名 stub port |
| `src/shared/api/sse.ts` | `src/lib/api/ai.ts`（事件格式參考）、`src/hook/useSosLifecycle.ts`（`@microsoft/fetch-event-source` 用法參考） | `5eadc71` | 2026-09-25 | 新增檔案，非逐行移植：Web 用 `@microsoft/fetch-event-source`（AI chat 走 raw-JSON-per-line 舊格式，SOS 走標準 `event:`/`data:` SSE），本版依 SDD ADR-07 統一以 `expo/fetch` 的 `ReadableStream` 自寫標準 SSE parser（`event:`/`data:`/`id:`/`:` 註解、CRLF、多行 data），純 parser（`createSseParser`）與 transport（`streamSse`）分離以利測試 |
