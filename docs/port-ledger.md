# 移植帳本（Port Ledger）

每個自 Web 版移植的模組一列（SDD §13）。Web repo：`/Users/yuen/orca/taipei-accessible-map`。

同步檢查：在 Web repo 執行 `git diff <來源 commit>..main -- <Web 來源路徑>`，有差異就評估是否跟進，跟進後更新「來源 commit」。

| 本 repo 路徑 | Web 來源 | 來源 commit | 移植日期 | 差異說明 |
|---|---|---|---|---|
| `src/shared/i18n/locale/{zh-TW,en}/translation.json` | `src/i18n/locale/{zh-TW,en}/translation.json` | `5eadc71` | 2026-09-25 | 原樣複製 |
| `src/shared/i18n/index.ts`、`language.ts` | `src/i18n/client.ts`、`src/i18n/setting.ts` | `5eadc71` | 2026-09-25 | 移除 `[lng]` 路由 redirect 與 `useAuthStore` 依賴；語系改由 `expo-localization` 偵測（任何 `zh*` → zh-TW，其餘無符合 → zh-TW）；使用者自選語系待 settings |
