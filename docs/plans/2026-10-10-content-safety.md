# 內容檢舉與封鎖：三端實作計畫

## 已確認範圍

- App 與網頁的每則自建評論、公開障礙回報提供「檢舉內容」「封鎖此使用者」。設定提供解除封鎖。
- 不新增管理網頁或管理端登入。沿用後端既有管理者權限，提供受保護的處理 API 與操作文件。
- 檢舉成功持久化後，分別寄信給團隊 Gmail 與檢舉者已驗證信箱。未驗證信箱仍受理，但明確提示無法寄確認信。
- 不修改部署環境、不寄真實郵件、不提交／推送／部署；交付程式、測試、設定說明。

## API 契約

所有路由沿用 `/api/v1` 與既有 response envelope、Bearer session 驗證。收件人與作者由後端決定。

| Method / path | 契約 |
| --- | --- |
| POST /content-reports | `{ targetType: 'review'|'hazard_report', targetId, reason, details?, language: 'zh-TW'|'en' }`；回傳 `{ caseNumber, receivedAt, confirmationEmail: 'queued'|'unavailable', duplicate }` |
| GET /user/blocks | 自己的封鎖名單 `{ items: [{ blockId, label, createdAt }] }`，不暴露 email |
| PUT /user/blocks | `{ targetType, targetId }`，由後端解析作者，避免公開私人障礙回報作者 ID |
| DELETE /user/blocks/:id | 冪等解除封鎖 |
| GET /content-reports/:id | 僅管理者查看案件與必要文字證據，不含 storage URL |
| POST /content-reports/:id/decision | 僅管理者；`{ requestId: UUID, action: 'dismiss'|'hide'|'restore'|'restrict_author'|'unrestrict_author', note }`，必填理由、留稽核紀錄 |

原因：`inappropriate_image`, `harassment`, `personal_information`, `spam`, `misinformation`, `other`。說明上限 1000 字；other 必填。

## 後端設計

1. 新增 content-safety 模組，遵循 router → controller → service → repository；模型採 MongoDB。
2. 案件及兩個獨立寄送狀態放同一文件，單次寫入確保不遺失待寄信工作。以檢舉者＋目標類型＋目標 ID＋內容版本唯一索引合併重送，不重寄已受理案件。
3. 背景工作逐收件角色 claim / lease / CAS、重試與 bounded backoff；使用穩定 Resend idempotency key。供應商接受不代表 Gmail 收件成功；超出供應商去重期限的模糊結果保留為待人工確認，不能承諾 exactly-once。
4. 伺服器設定 `CONTENT_REPORT_TEAM_EMAIL`；沿用 RESEND_API_KEY / RESEND_FROM。缺設定保留工作並可重試，不把秘密寫前端或 log。
5. 文字信件與 HTML escaping；確認信僅案件編號、時間、原因與受理文案。團隊信件使用必要文字快照，不附私人圖片或直接 storage URL。
6. authenticated user/IP 限流、內容可見性驗證、不可檢舉／封鎖自己、不可封鎖無作者內容。以目標解析作者，不接受前端宣告作者。
7. 封鎖為單向個人偏好。登入列表與摘要在後端排除被封鎖作者；匿名瀏覽保持公開結果。個人封鎖不改變其他使用者或路線安全判斷。
8. moderationHiddenAt 與既有 active/deleted、hazard verified/expired 分離。下架後公開列表／詳情／摘要／路線證據皆排除；恢復不復活已刪除或過期內容。限制作者只阻止新增／修改 UGC，保留導航、帳號管理與檢舉權利。
9. 管理動作需最新 DB role，稽核記錄含案件、操作人、動作、理由、時間。案件含個資，明訂保留與清除策略；帳號刪除不留下可用收件工作。

## App 與網頁

1. 沿用既有登入、API client、語系、UI 元件。新增獨立 content-safety API／狀態／表單。
2. 「⋯」選單 → 原因／補充說明 → 送出；防連點、錯誤重試、成功案件編號、確認信狀態。未登入引導一般登入。
3. 封鎖先說明影響，成功後移除相關內容並重抓摘要／地圖；設定頁具 loading / empty / error / retry / unblock。
4. 帳號切換立即清理案件成功狀態與封鎖資料；所有非同步結果需帳號／request generation fence。
5. zh-TW / en 全部產品文字；可存取標籤、觸控區域、鍵盤與捲動。

## 執行順序與驗收

1. 契約與獨立計畫審查 → 後端模型、API、寄信 worker 與處分／過濾。
2. 真正執行 service / worker / repository 的測試：偽造作者、私人內容、自我封鎖、重複提交與競態、兩封信獨立重試、過期 lease、未驗證／已刪帳號、權限、隱藏與恢复。
3. App、網頁串接與狀態測試：未登入、各檢舉原因、提交失敗／成功、未驗證信箱、封鎖／解除、帳號切換與晚到回應。
4. 三端 lint / typecheck、後端 build、相關 regression tests；瀏覽器與 iOS 模擬器驗證（工具可用時）。測試採隔離資料與假寄信，不碰 production DB／.env。
5. 獨立 diff 審查、修正、更新實作結果。交付時分開列出通過的靜態／單元／DB／UI 驗證與未執行的真實收件／部署驗證。

## 部署設定與營運

團隊 Gmail 已確認為 nutcaiedlab@gmail.com，僅在部署時填入後端環境變數。上線前設定寄件網域與收件地址，手動驗證團隊與測試帳號收件；指定 Gmail 值班與處理時限。管理 API 僅由授權維運人員呼叫，不放郵件一鍵處分連結。

## 獨立審查後的具體決定

- 封鎖名單使用 opaque blockId；label 是 review / hazard_report 中性來源標記，不洩露作者。
- 團隊地址 **僅** 從後端 .env 的 CONTENT_REPORT_TEAM_EMAIL 讀取，無寫死 fallback；使用者指定 nutcaiedlab@gmail.com 只寫在 .env.example／部署文件，不動實際 .env。
- 首次發送前凍結完整 payload；寄前確認帳號／email。Resend 24 小時去重窗口，超過23小時尚未確認者轉 manual_review。
- 已依使用者最新要求改為 standalone：案件與兩封工作單文件原子寫入；配額以caseId冪等預留並恢復；處分以持久化意圖、目標版本CAS與恢復記號完成稽核，不使用transaction。詳細協定見後端 `docs/CONTENT_SAFETY.md`。
- open 案件365天TTL，結案後90天且最多建立後365天；帳號刪除整合既有sweep清除關聯案件與封鎖，寄信配額最多2小時。Gmail／Resend副本須營運端清理。
- 增加 GET /content-reports 管理者游標查詢以追蹤 pending/manual_review；不新增管理網頁。
- 導航增加 GET /a11y/reports/safety，仅傳有效verified安全事實，不含使用者原文／圖片／作者；不套個人封鎖但套平台下架。
- 既有匿名障礙提交保留，登入的受限帳號不可提交；帳號限制不保證防止登出後匿名濫用。
- 所有新增個人化GET與mutation都綁帳號epoch；401 refresh前後與重試入口均檢查，避免舊帳號請求影響新帳號。


## 實作與驗證結果（2026-10-10）

三端已完成上述契約與 UI，不新增管理網頁。後端部署與維運細節見 `taipei-accessible-backend/docs/CONTENT_SAFETY.md`。

| 範圍 | 結果 |
| --- | --- |
| Mobile 全套 Jest | 151 suites／1476 tests 通過 |
| Mobile 型別／lint | app、plugins 型別通過；lint 零警告 |
| Web 全套 Vitest | 79 files／943 tests 通過 |
| Web 型別／lint | 型別通過；lint 零錯誤、3 項既有測試警告 |
| Backend 相關回歸 | 12 files／152 tests 通過，含 20 項真實隔離 MongoDB replica-set 檢舉／寄信整合測試 |
| Backend build／架構 | 通過；正式程式 TypeScript 編譯通過 |
| Backend lint | 零錯誤；943 項警告。乾淨 HEAD 為 934 項，額外 9 項來自既存、未追蹤的 `reports/hazard-ai-implementation/browser-fixture.tsx`，本次新增模組零警告 |
| Backend 完整測試型別 | 35 項既有錯誤，與乾淨 HEAD `bf4d300` 的錯誤內容及行號完全一致；本次未新增 |
| Web 瀏覽器 | 真實元件＋API fixture 驗證表單必填、失敗重試、成功、信箱不可寄狀態、封鎖／解除與摘要更新、帳號切換／晚到回應 |
| iOS 模擬器 | iPhone 18 Pro 實際 App 檢舉畫面開啟、版面截圖檢視；完整提交／鍵盤／解除封鎖操作未在模擬器跑完，由 hook／API 測試覆蓋狀態 |
| 獨立複查 | Web、Mobile、Backend 已修正發現問題，複查無新增阻擋項目 |

最後修正：配額初始化與扣抵分離，交易內重查去重案件，並行重送在 19→20 額度邊界也只消耗一格；寄信每次操作重新讀取時間，資料庫回應延遲超過 lease 時拒絕派送。兩者均有回歸測試。

驗證界線：郵件傳送器為測試替身，資料庫為本機隔離 replica set；未驗證正式 DB 交易設定、Resend 寄件網域、Gmail 真實收件、已部署 API 或實機完整跨端流程。沒有修改實際 `.env`、提交、推送、部署或寄出真實郵件。


## 最新修訂：支援 standalone MongoDB

以上初版測試數與 replica-set 測試方式屬歷史記錄。使用者已確認團隊通知與受理確認信皆真實收到；此次後端進一步取消多文件交易依賴，保留可恢復、可稽核配額與處分。App／Web檢舉與封鎖成功契約維持相容，不需要修改前端或部署資料庫拓樸。

本次後端相關12個測試檔／167項全數通過，其中35項以實際standalone MongoMemoryServer測試；獨立審查通過。正式build、架構檢查及新增模組lint通過；完整測試型別檢查仍是35項與乾淨版本一致的既有問題。未重啟現有容器，需重新build／部署後驗證線上完整流程。完整結果見後端 `docs/CONTENT_SAFETY_VERIFICATION.md`。
