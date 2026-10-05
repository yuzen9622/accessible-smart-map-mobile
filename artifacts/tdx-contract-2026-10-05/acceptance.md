# App TDX 契約：實作與模擬器部分驗收

> 2026-10-05 驗收完成後已移除截圖、錄影、HTTP／Orca log 與驗證用 helper 腳本（`scripts/tdx-app-*`、`scripts/verify-tdx-app-*`）；下文提到的檔名僅為當時紀錄。

日期：2026-10-05。依據：`/Users/yuen/project/taipei-accessible-backend/docs/reports/tdx-frontend-change-contract-2026-10-05.md`。

## 結論

**App 程式、自動化回歸與下列 Orca 真實模擬器操作通過；不宣稱整份契約或實體裝置全流程全部完成。**

- 全量 Jest：123 suites／1222 tests 通過；公車子集：21 suites／268 tests；typecheck、lint、`git diff --check` 通過。
- 獨立 source 審查返工後複驗 PASS，無 blocking；另有兩項補測建議，列於下方。
- 已實際透過 Orca HID 點選、展開 sheet、拖曳站序；不是以 RNTL、HTTP 200 或靜態圖片替代操作。
- fixture：2／10／255、同方向多支線、數字／缺 ETA／班表／明確狀態、開啟提醒後失去 ETA 的 UI 狀態，已有原生證據。
- 真服務使用 `https://map-dev.yuzen.dev`：307 路線資料載入、站序／ETA 與實際方向 0 → 1 點選已驗證。
- dev `stop-arrivals` 仍為路由不存在的 404，站牌真整合未驗收；307 未提供 2／10／255 真資料，不把 fixture 當 TDX 真案例。
- 未實際等待通知送達、完成移動車輛的上車／下車全旅程或實體裝置／VoiceOver 操作。

僅改 App 公車 feature、相鄰測試、中英字典與驗收 helpers／artifacts。未改 Web、後端、`.env`、依賴、原生專案、部署設定；沒有 commit／push／部署／匯入資料／EAS 發布。

## 實作檔案與原因

| 檔案／區域（`src/features/bus/`） | 責任 |
| --- | --- |
| `types/transit.ts`、`api/transit.ts` | 嚴格數字五值方向；JSON 字串等仍無效；arrival／positions 保留 0／省略／255 區別，不新增後端 query |
| `domain/busDirections.ts`、`domain/screenParams.ts`、`domain/index.ts` | 明確解析導覽字串；按 `(subRouteUid, direction)` 產生選單／選擇；不捏造 UID |
| `domain/busLegStops.ts`、`controller/liveBusTracker.ts`、`controller/busWatchers.ts` | 依有效站序與支線唯一配對 GTFS → TDX，不以 GTFS direction 硬配，不繞圈；255 禁方向依賴追蹤 |
| `domain/stopBoard.ts` | ETA／車牌同筆與支線配對；同名站無唯一位置時不猜第一站 |
| `hooks/useRouteLiveBuses.ts`、新增 `hooks/useTrackedArrival.ts` | 支線／方向／exclusive 改變立即隔離舊資料；失敗清即時資料 |
| `hooks/useBusRouteDetail.ts`、`hooks/useStopArrivals.ts` | 換目標隔離；輪詢／手動刷新 latest-started-wins；失敗清 ETA、保留靜態站序；舊 controller 不清新 spinner |
| `api/busRouteDetailCache.ts` | 子路線快取隔離，同筆資料不重設收件時間 |
| `controller/arrivalReminder.ts` | 支線／方向提醒 key；generation 阻擋等權限／排程的舊通知；null ETA 先使未寫 store 的 start 失效 |
| `screens/BusRouteScreen.tsx`、`screens/BusStopScreen.tsx` | 動態選單、保留現有自動選擇、導航 context 隔離、精確追車／提醒 |
| `domain/busStopBadge.ts`、`components/busText.ts`、`components/etaDisplay.ts` | 缺 ETA／空白／正常顯示「暫無到站資訊」；保留明確狀態與班表 |
| `src/shared/i18n/locale/{zh-TW,en}/translation.json` | 2／10／255 獨立名稱與未知狀態文案 |
| 相鄰 `__tests__`、新增 hook／screen／reminder／ETA 測試 | 正反例、反序回應、通知競態、支線隔離與 RNTL 元件回歸 |

`BusLeg.direction` 維持 GTFS 0／1；捷運／臺鐵／高鐵型別未扩充。暫時的 API URL／error 診斷已還原，未留在 source。

## 工具鏈與審查

| 命令／檢查 | 結果／證據 |
| --- | --- |
| `npm test -- --runInBand` | 123 suites／1222 tests，exit 0；`jest.log` |
| `npx jest src/features/bus --runInBand` | 21 suites／268 tests，exit 0；`jest-bus.log` |
| `npm run typecheck` | exit 0，含 plugins；`typecheck.log` |
| `npm run lint` | exit 0；`lint.log`；Orca helpers 加入後再跑通過 |
| `node --check scripts/{tdx-app-fixture-server,verify-tdx-app-orca,verify-tdx-app-http}.mjs` | 三支通過 |
| `git diff --check` | exit 0 |
| 7 個修正 source 的主動 LSP probe | 0 diagnostics，但 7 個 inconclusive，不當成 LSP 確認乾淨；以 tsc／lint 實跑為準 |

初審三項 blocking、兩項 warnings 已先紅測重現再修正：

- `review-regression-red.log`：5 個失敗測試（自動選擇、exclusive 改變、pending notification 失效）。
- `review-regression-green.log`：修正三項後 3 suites／48 tests 通過。
- `review-warning-red.log`：8 個失敗測試（重複站配對、同 key 手動／輪詢反序）。最終均包含在全量綠測中。
- 最後有界唯讀 reviewer：**PASS，無 blocking**；獨立 focused Jest 5 suites／70 tests 通過。
- 非阻擋建議：再直接補測「poll abort 舊 manual → 新 manual → 舊 controller 晚回」及導航 context 變更時丟棄舊 picked key。

## Orca 啟動及環境修正

已撤回先前「沒有可用觸控 driver，因此無法操作」的結論。

1. 依安裝版 `orca skills get orca-cli`、`orca skills get orca-emulator` 載入指令。
2. 初次 attach 卡在 helper 的 SimulatorKit rpath。框架實際位於 `/Applications/Xcode.app/Contents/SharedFrameworks`。
3. 用暫時 `DYLD_FRAMEWORK_PATH` 啟動 Orca 安裝版的 serve-sim wrapper，再 `orca emulator attach 'iPhone 18 Pro'` 接手。未修改 helper binary、Xcode、系統設定或 App。
4. `orca-attach.json` 是初次失敗；`orca-attach-success.json` 是成功的 iOS session。Orca 提供 HID 與 AX；截图由 `simctl screenshot` 保存。
5. Expo 57 開發模式的 `expo/virtual/env` 會用 `.env*` 覆蓋 process env。實際診斷曾確認 runtime 仍指向正式 API；那些早期畫面不算 dev／fixture 通過。
6. 改採 `expo start --dev-client --no-dev --localhost --clear` 的**本機 bundle 模式**，讓 process env 靜態內嵌。已檢查實際 bundle：fixture 為 `http://localhost:4317`，最終 dev 為 `https://map-dev.yuzen.dev`。未改 `.env`，也未發布。
7. fingerprint manifest 超過 dev-client timeout，使用 `/tmp` 的原樣 manifest replay；其他 bundle／asset／HMR 請求轉送原 Metro。不改 API 回應。最終已切回 dev manifest／Metro。

fixture server 僅綁定 IPv4／IPv6 loopback；標示合成資料，`client: mobile` HTTP 記錄證明 App 有取資料。`/__fixture/control` 只控制本機合成 ready／unknown／503 情境，不是新增正式後端端點。

## 實際模擬器操作證據

| 操作／觀察 | 證據 |
| --- | --- |
| 10：Orca 點 sheet 控點由收合 → 半屏 → 展開；循環線、八站站序、暫無 ETA、班表、末班、0／2 與明確尚未發車正確顯示；null ETA 提醒 disabled | `native-fixture10-orca.png`、`orca-ax-fixture10-full.json`、對應 tap JSON |
| 2：實際展開；迴圈、等待站未知、班表、進站中與 disabled 提醒 | `native-fixture2-orca.png`、`orca-ax-fixture2-orca.json` |
| 255：方向未知資料與站序保留，沒有方向依賴提醒按鈕 | `native-fixture255-orca.png`、`orca-ax-fixture255-orca.json` |
| A10 → B10 → A0 → B0 → A10：真 HID radio 點選，各自站序正確；A 為 8 分鐘、B 為 13 分鐘，不混用 | `native-branch-*-selected-orca.png`、相鄰 AX JSON、`orca-actions.jsonl` |
| 有效 ETA：點「車快到時提醒我」後出現「到站前 3 分鐘提醒 · 點一下取消」；既有通知授權，不需新權限彈窗 | `native-reminder-enabled-orca.png`、`orca-tap-start-reminder.json`、`orca-ax-reminder-permission.json` |
| 同目標 ETA 失效：本機 fixture 切 unknown，Orca Home／返回前景後重查；8 分鐘改暫無資訊，提醒狀態不再 active、按鈕 disabled，原 0 的站不再冒充進站中 | `fixture-control-unknown.json`、`orca-background-for-eta-loss.json`、`native-eta-loss-foreground-orca.png`、`orca-ax-eta-loss-foreground.json` |
| 真拖曳站序：Orca begin/move/end gesture；同一第 1 站 AX y 從 0.4893 → 0.4291 | `orca-gesture-scroll.json`、`orca-ax-after-scroll.json` |
| dev 307：載入真站序／ETA／地圖；點選方向 1 後標題改「往 臺北客運板橋前站(藝文)」 | `native-dev307-orca.png`、`native-dev307-return-selected-orca.png`、`orca-tap-dev307-return-corrected.json`、`orca-ax-dev307-return-selected.json` |

`node scripts/verify-tdx-app-orca.mjs` 實跑 **exit 0**，六個檢查群組通過；`orca-native-verification.log`。它真的呼叫 Orca tap／AX，不注入元件事件。第一次 branch selector 找不到，是 helper 誤假設名稱前綴；改依實際 AX 的「支線B・循環線」匹配後通過，不是 App bug。

早期 `*-header-only.png`、網路錯誤、dev launcher 截圖與 Home 畫面僅診斷資料，不作正向驗收證據。307 第一次點選座標被 ETA 高度變化移動，已依最新 AX frame 修正；只以 `return-selected` 作切換成功證據。

## 真實 HTTP（不是 fixture）

`http-dev-final.json`／`http.json`：`2026-10-05T08:11:33.263Z` ～ `08:11:37.314Z`（UTC），base URL `https://map-dev.yuzen.dev`。

- 307 arrival 省略／0、route-detail、positions、timetable：200。
- route-detail：0／`TPE157463`／66 站；1／`TPE157462`／62 站。
- arrival 2／10／255：資料不存在 404；不能當作新方向真回傳案例。
- stop-arrivals：路由不存在 404。
- 較早 `http-dev-additional.json`：非法 direction 3 為 400；positions 0 為 200、2／10／255 為無營運車輛 404；Taichung 99 只有 0／1。

重跑唯讀收集：

```bash
TDX_VERIFY_BASE_URL=https://map-dev.yuzen.dev \
TDX_VERIFY_OUTPUT=artifacts/tdx-contract-2026-10-05/http-dev-final.json \
node scripts/verify-tdx-app-http.mjs
```

該 helper exit 0 表示成功保存結果，不表示所有端點成功。

## 契約矩陣與未驗證界線

| 編號 | 結果 |
| --- | --- |
| D01／D02／D03 | 五值／非法值／導覽參數自動化通過；Native 2／10／255 已顯示。非三種真 TDX 回傳案例 |
| D04／D05 | 原生 fixture 2／10／255 真展開與畫面通過，255 沒有提醒／追蹤入口 |
| D06 | 原生同方向雙支線實際切換、站序／8 vs 13 ETA 通過；精確車牌／cache／UID-less 隔離另由自動化通過 |
| D07／D08 | GTFS→TDX、重複站名／歧義／不 wrap 自動化通過；未在模擬器走 OTP 全旅程／重複站 fixture |
| D09 | query 正反例、自動化、dev 真 HTTP 與 native fixture HTTP 記錄通過 |
| D10 | 原生方向／支線切換通過；反序回應／pending notification 精確 race 由自動化通過，未以 HID 重現所有競態 |
| E01／E02／E03 | 原生 0／2／8／null、班表／明確狀態／未知文字通過 |
| E04 | 原生開啟提醒後同目標 ETA→null，UI 取消 active／disabled 通過；失敗清車牌與 pending permission/schedule 由自動化通過。未直接查 OS 排程佇列或等通知送達 |
| E05 | 原生回前景重查及進站資料失效通過；cache 收件時間／單次 elapsed 由自動化通過，未做長時間車輛移動驗收 |
| R01 | dev 真 307 0／1 與原生支線 fixture 切換通過 |
| R02 | 全量回歸通過；未做捷運／雙鐵原生全流程 |

尚未完成：stop-arrivals 真整合、實體裝置／VoiceOver、完整移動車輛上車／下車追蹤、實際通知送達、所有精確 race 的原生重現。不得將上表當作所有矩陣已完成實體操作。

## 後續及重現注意

- 補可用 stop-arrivals 後另外驗收；本次沒有新增／部署該路由。
- 在模擬器之外補實體裝置及未跑全旅程；不要自行匯入正式資料或發布。
- 使用 process env 測試時，SDK57 請加 `--no-dev`；本機 App API：`EXPO_PUBLIC_END_POINT=https://map-dev.yuzen.dev`。若用一般 dev/HMR 模式，不能假定 shell 覆寫勝過 `.env`。
- 原生 helpers 均為本機測試；Orca helper 驗完會 kill，裝置保持 booted。dev Metro 保留便於繼續操作；沒有永久系統／環境檔設定。
