# 補驗：站牌 404、移動車輛全旅程、通知送達（2026-10-05）

> 2026-10-05 驗收完成後已移除截圖、錄影、HTTP／Orca log 與驗證用 helper 腳本（`scripts/tdx-app-*`、`scripts/verify-tdx-app-*`）；下文提到的檔名僅為當時紀錄。

iPhone 18 Pro 模擬器（iOS 27），`expo start --dev-client --no-dev` 內嵌 endpoint。

## 1. 站牌 `/bus/stop-arrivals` 404

- 原因在後端：端點只在 backend PR #32（`yuzen9622/bus-stop-arrivals`，e739438，2026-09-30）上，未合併 main。dev（本機 docker `taipei-backend`，從 main 建置）與正式都回 Express 404。
- PR #32 與 main 衝突（`bus.service.ts`、兩個測試檔），`direction` 仍是舊的 `0|1`，未跟上 10-05 五值契約；CI 失敗原因是 `pnpm audit`，不是測試。
- App 對 404 刻意降級（`useStopArrivals` → `unavailable`）：只列行經路線、沒有 ETA，不顯示錯誤。`stop-404-dev.png`（真 dev，proxy log 記錄 404）。

## 2. 移動車輛

- 路線詳情（`FIXTURE-MOVE`，合成）：`move-00*`、`move-at-*.png`。還有 4→3→1 站、ETA 8→5→2、已到你這站／進站中；車過站後自動改追下一班（MOVE-NEXT）。下車站「共 2 站」靜態顯示，這頁沒有「已上車」模式。
- 導航（真 dev 規劃 小18 士林區農會→故宮博物院 + 真站序，只有車輛／ETA 合成，`scripts/tdx-app-move-proxy.mjs`）：`nav-walk-*`、`nav-bus-at-*`、`nav-ride-*`、`nav-arrive.png`、`move-proxy-http.jsonl`。
  - 步行到站 → 等候指示 → **一到站牌就切到「抵達故宮博物院站後請下車」**（車還在 3 站外）。
  - MOVE-LEAD marker 到上車站；車過上車站後 tracker 回空陣列。
  - 搭乘中距離遞減，到故宮站切成步行指示，最後顯示已抵達。
  - **問題**：下車後到按「結束導航」前，仍每 15 秒打 arrival + positions（log 10:46:58→10:50:51）；按結束後停止。原因是 `useNavigationEffects` 在 `busOrdinal === null` 時直接 return，沒有清 `activeBusLeg`。

## 3. 通知送達

ETA 4 分鐘時開提醒（約 18:30:13）→ Home 進背景 → 18:31:13～18:31:20 之間 iOS 顯示「FIXTURE-MOVE 快到了／預計 3 分鐘後到 移動你這站」：`notify-01-enabled.png`、`notify-02-delivered-background.png`、`notify-rec.mov`。回前景後按鈕已恢復「車快到時提醒我」：`notify-03-after-fire-foreground.png`。前景送達與實體裝置未測。

## 4. 修正：等車／搭乘導引＋下車後停止輪詢（同日晚間）

改動：`navigation/domain/transitRide.ts`、`transitCopy.ts`、`controller/transitRideRuntime.ts`（新）；引擎 `maxStepIndex`；HUD／Live Activity 文字；`useNavigationEffects` 最後一段公車下車後清 `activeBusLeg`；公車 feature `fetchLegSnapshot`／`fetchRideArrival`／`watchRideArrival`、`busStore.boarded`／`legArrival`。

模擬器（dev 規劃＋指令的離線重播 `offline/`，車輛／ETA 合成，`transit-guide-proxy.jsonl`；當時 dev 因磁碟滿 530）：

- `guide-01-approach.png`：70 m／前往「士林區農會」站牌搭乘「小18」／約 6 分鐘到站。
- `guide-02-at-stop.png`：到站牌停在上車步驟：6 分鐘／請在「士林區農會」站牌等候「小18」。
- `guide-03-bus-at-{2,3}.png`：2 分鐘 → 進站中／即將進站，請準備上車。
- `guide-04-ride-*.png`：上車自動判定 → 還有 9 站約 17 分 → 6 站 → 2 站 → 下一站「故宮博物院」請準備下車 → 下車後切步行。
- log：等車每 15 秒 arrival（士林區農會）＋positions；11:57:56 上車後只剩 arrival（故宮博物院）；11:59:30 下車後到 12:00 無公車請求。

自動化：全量 125 suites／1252 tests；typecheck、lint 0。新增測試經突變檢查（拿掉步驟上限 6 個失敗；拿掉速度門檻 1 個失敗）。語音內容由單元測試驗證，模擬器未實聽。

### 獨立審查後修正

審查（無實作背景的 agent）找到並已修：上車時可能鎖到下一班車牌（改成離開站牌後凍結車牌）、預覽模式仍顯示／播報公車導引、單一 GPS 飄移點就判定上車（改成連續 2 個樣本，離站 200 m 以上除外）、一開導航已在第二段公車上時卡住、上車標記遺失不重試、換 leg 時舊分鐘數殘留、英文播報下車句與下一步沒空白。每項都有測試且經突變檢查會轉紅。第二次模擬器跑（`guide2-*.png`、`transit-guide-proxy-2.jsonl`）結果相同；12:18:00 下車後無公車請求。未改：既有的「接著」列與 a11y label 用全形逗號（沿用現有慣例）、重算時同 key 早退（改動前就存在）。全量 125 suites／1257 tests；typecheck、lint 0。
