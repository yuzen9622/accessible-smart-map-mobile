> 歷史來源紀錄：由 `codex/indoor-navigation` 的完成快照 `70cbfc2` 保留。以下測試與畫面屬於原工作回合，不能視為 2026-10-31 合併後的驗證。原已完成計畫檔仍維持刪除。

# 無障礙智慧地圖／Accessible Smart Map：手機版室內導航

日期：2026-10-29。基準：mobile `283348b`；工作開始時，隔離工作區與來源專案 HEAD 相同且皆乾淨。Expo `~57.0.31`、React Native `0.86.3`、MapLibre RN `^11.4.0`。本次只修改 mobile，不提交、推送或部署。

## 目標與可信度邊界

室內功能併入既有原生流程：原 Explore 搜尋包含 `venue-place` → 原地點詳情 → `/plan` 共用起訖與無障礙模式 → `/routes/[index]` 路線詳情 → `/navigation` 導航。戶外到室內的轉接在同一導航頁完成；不新增 `/indoor` 入口、獨立室內規劃面板或另一套搜尋／地點詳情。地圖仍可瀏覽建物與樓層，場館和地點清單以 API 實際回傳為準。

只使用後端 `detail.places` 的 ID 規劃；手機不自行推導門位、連線、電梯停靠或最短路徑。coverage 不代表現地確認或輪椅可達。保留 heightPending、note、fixme、arrivalKind 與 doorKnown；未知門位的房間或 corridor 到達類型會說明抵達空間前公共走道，不將校門等地點誤稱為公共走道。瀏覽樓層與使用者確認所在樓層是不同狀態，GPS 不推進室內步驟。

3D 使用校園同名樓層的 grounded cutaway：各棟依選定樓層名稱顯示自己的平面，將該層平移到地面以便閱讀，低牆、樓板厚度及入口顯示寬度是展示尺寸。保留來源高度與待確認註記，但畫面高度不代表實測海拔、層高、淨高或無障礙合規性。井道幾何不代表該樓層有電梯停靠；停靠點只使用 connection 的已發布樓層資料。

## 階段、依賴與驗收

| 階段 | 實作／依賴 | 可檢核驗收 |
| --- | --- | --- |
| A1 契約與資料 | 沿用 shared API client；GET venues、GET venue detail、共享 venue route API；解析邊界、取消與 request generation；場館 ID＋版本識別 | catalog/detail/route 真實契約對齊；選點重新讀取 detail；舊請求不覆蓋新選擇；版本不符時拒絕採用舊起訖或路線 |
| A2 原生樓層圖與搜尋 | `features/indoor` 提供 MapLibre layers；原 Explore、路線端點搜尋與地點詳情納入 `venue-place`；沿用 mapCamera 與既有 `(sheet)` 面板 | 建物、樓層可切；樓板／房間／走廊／低牆與地點可視；文字搜尋與整間點選可開原地點詳情，再設為起點或終點；同一地圖、48pt 操作與可讀標籤 |
| A3 共用規劃與預覽 | `routeSession` 為唯一規劃 owner；`/plan` 保留 venueId/placeId、樓層與版本；同場域雙端點走 venue route API，結果保存在 `indoorRoute`，使用後端 segments/steps | 四種無障礙模式、同層／跨層預覽、端點交換與清除、自動重算、取消競態；室內結果開原 `/routes/[index]` 的 index 0；不偽造 AccessibleRoute；NO_ACCESSIBLE_ROUTE 不降級成一般路線 |
| A4 同頁確認式導引 | 從原路線詳情啟動 `/navigation`；indoor store 只執行已採用的路線與使用者確認進度，不另行規劃 | 開始前確認起點，換層顯示目標樓層並提供「已到…」；瀏覽樓層不推進；確認後鏡頭移至下一步；可結束；位置待確認清楚；室內段不觸發戶外 GPS 偏航引擎 |
| A5 戶外→室內 | 戶外／目前位置到 venue-place 沿用 accessible-route 的 destinationVenuePlace／venueArrival／venueLeg；到入口後在原 `/navigation` 確認轉入室內段 | 不以房間中心代替入口；戶外終點與室內起點來自後端；不跳入另一個室內頁；室內往校外或不同場域之間尚不支援時保留端點並明確回錯，不自行補接線 |
| A6 整合驗證 | meaningful Jest、lint、app/plugins typecheck、diff review、可用 iOS Simulator | 正常／失敗重試、取消競態、版本變更、同層／跨層、導引確認、戶外流程回歸；實際執行與未驗證項目分開記錄 |
| B 原生 grounded 3D | 已以 MapLibre fill-extrusion 實作單層低牆／樓板、web 配色、整間選取、2D／3D 切換；使用相同 Boolean 幾何與共牆／入口規則 | 保留洞與 void；不以井道推導停靠；各棟同名樓層共同顯示；跨棟路線保留來源相鄰邊，缺少該層幾何的建物才以薄輪廓背景呈現。公開資料樓板幾何對照證據保留；本輪共用流程的模擬器驗收另列，不宣稱材質、陰影或像素完全一致 |
| B2 進階場景（後續） | 實體樓梯、立體路線、動畫與更精細光影尚未實作；若確有需求，再比較 native layer、局部 WebView 或 Expo GL | 須另驗收遮擋、記憶體／幀率、原生事件／生命週期及無障礙；不得整站包 WebView 取代原生流程。現有 grounded cutaway 不視為已完成這些能力 |
| C 完整串接 | 室內 AI 語音、室內→校外依賴後端新增明確契約；室內藍點／自動判層另需定位硬體或感測融合評估 | 契約測試、語音 session 層級進度與中斷恢復、入口轉接；定位需現場量測樓層準確率與失效行為。現有草案與 GPS 不視為已完成能力 |

依賴順序 A1 → A2/A3 → A4/A5 → A6。資料層、地圖整合與契約核對可平行，跨 feature 組裝由主實作者整合。

## 架構與 UI 決策

- `routeSession` 擁有全部規劃輸入、請求取消、結果與結果身分；`originVenuePlace`／`destinationVenuePlace` 保留場域、房間、建物、樓層與來源版本。`indoorRoute: VenueRoute | null` 與原戶外結果並存，不把室內路線包成假的戶外路線。
- `features/indoor` 負責圖資、幾何、建物／樓層瀏覽與已採用室內路線的手動執行。indoor store 不保留第二份規劃端點或模式，也不發起 route planning。跨 feature 組裝由 app 層處理；`map` 不反向依賴 indoor/route/navigation。
- `shared/venue` 提供 VenueRoute／VenueMode、解析器與場域路線 API，避免經 indoor UI barrel 引入循環依賴。只有同一 venue 的兩個室內端點直接規劃；戶外到室內沿用原 accessible-route，讓後端決定入口。
- 搜尋結果、搜尋歷史、地點詳情與路線端點都以 `venue-place` 身分串接；詳情設起訖經 `/plan` 的 venueId／venuePlaceId／venueField，重新解析最新地點後交給 `setVenueEndpoint`，不把房間降成一般座標。
- 保留 API `[lng,lat,z]` 地理座標。`indoorSceneGeoJSON` 以與 web 相同的局部公尺轉換處理幾何，再轉回經緯度交給 MapLibre；來源座標與高度不被覆寫。樓層與連接語意沿用伺服器。
- 沿用原 Explore、地點詳情、規劃與路線詳情的 Expo Router formSheet。純室內規劃隱藏戶外交通方式與沿途設施篩選，仍共用原無障礙模式。導引在原導航頁呈現目前步驟與確認操作，不另設室內入口或資料說明面板。
- 頂部只保留建物與瀏覽樓層控制；導引面板顯示目前步驟與確認操作，不重複放位置標籤。切樓不改變導引進度。相機首次置中以目標 pitch／bearing 計算 bounds；iOS 先以零時長套用姿態，避免原生套用順序造成遠距目標偏移；恢復畫面時不飛到其他建物／樓層的舊選取點；只有明確導引確認才更新步驟鏡頭。
- 瀏覽室內時隱藏一般底圖的立體建築，以免遮住 grounded cutaway；一般地圖操作、定位與原有路線圖層仍保留。建物選單的「周邊地圖」可返回一般地圖。
- 瀏覽狀態不代表導航採用或使用者位置；不清掉未經確認的戶外行程。戶外到室內須在導航頁明確確認 handoff，切入後由手動步驟執行，不再使用戶外 GPS 偏航引擎。室內導引不聲稱具備即時定位、偏航偵測或自動換層。
- 新增純 JavaScript `polygon-clipping` `0.15.7`，沿用 web 的 union／intersection／difference，處理重疊樓板、孔洞、挑空與牆體裁切。這項依賴不引入原生模組或另一套 renderer；渲染仍使用既有 MapLibre，並沿用既有主題、圖示、API、狀態與測試慣例。

## Web 幾何對照與原生呈現範圍

- 樓板由有效 floor patches 合併，保留來源 polygon 洞並扣除明確 void。共牆、部分共邊與凹角接合沿用 web `roomWalls` 規則；入口依已發布拓撲開口，顯示寬度為 1.6 公尺，不能當作現地門寬量測。
- 展示樓板厚 0.16 公尺、低牆高 0.85 公尺，一般展示牆厚 0.12 公尺；來源牆沒有厚度時的展示預設為 0.09 公尺。web 可用零厚度牆面表示的邊界，在 native 以 0.01 公尺 display buffer 呈現。這些尺寸與 `displayOnly`／`thicknessKind` 一起區分來源值及展示值。
- 同一場域的各建物依選定樓層名稱呈現各自 cutaway；缺少該同名樓層或 coverage 為 false 時，只保留高 0.035 公尺的薄 footprint 背景，不回退為其他樓層，不代表其完整立體外觀。2D 為 pitch 0°，3D 為 48°；沒有全樓層疊層或 exploded view。
- 房間、走廊、電梯／樓梯與非停靠井道配色對照 web `indoorTheme`，選取會標示整個對應空間。實際停靠標籤與文字替代資料來自 connection，標籤避重只影響顯示，不刪除來源資料。
- 原生路線使用 MapLibre 線條與起訖標記。保留來源路徑的相鄰跨棟邊及出入口轉接；地面視圖保留有依據的戶外段，同棟路段依樓層展示高度裁切，不跳過隱藏片段補線。尚未移植 web 的立體路線幾何。
- web 使用 Three.js 材質、PCF 陰影與 ACES tone mapping；native 使用 MapLibre fill-extrusion 與其光照／垂直漸層。幾何與配色對照不等於像素、材質粗糙度、陰影或色調映射完全一致。

## 來源與驗證紀錄

- Web：`src/lib/indoor/*`（包括正式 `planJourney.ts`／`backendRoute.ts`）、原搜尋／地點詳情與 `src/components/BottomSheet/RoutePlanContent.tsx`、`src/stores/useIndoorCatalog.ts`，唯讀參照。
- Backend：`docs/api/venue-indoor-routing.md`、`src/modules/venue/*`、`src/modules/accessible-route/venue-leg.types.ts`，唯讀參照。
- 官方：[Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/)、[Expo UI 57](https://docs.expo.dev/versions/v57.0.0/sdk/ui/)、[Router Stack](https://docs.expo.dev/router/advanced/stack/)。
- 公開 production detail 的 parser 核對保留本輪 renderer 使用的 tags、幾何、連接與厚度 metadata；真 API detail 與 6 條同層／跨層 route 已通過契約解析。
- 公開資料共 33 個樓層，產生 6299 個 Polygon features。獨立檢查通過有限座標、閉合 rings、非負展示高度、建物／樓層／選取關聯與來源不變；7 個明確 void 未被樓板或空間面封住。
- 與 web 的樓板對照，面積對稱差最大為 `4.54e-8 m²`，屬浮點差。此數值只驗證這批資料的 floor 幾何，不證明其他牆體細節、像素、陰影或現地量測正確。
- 渲染幾何完成證據保存在 `output/indoor-redesign/indoor-scene-validation.json` 與 `output/indoor-redesign/indoor-scene-web-floor-parity.json`。同目錄的先前畫面只反映當時渲染狀態，不作本輪共用搜尋／規劃／導航流程的最終驗收證據。
- 最後版本整合測試 **89 suites／880 tests 通過**，涵蓋 indoor／route／place／navigation、NavigationSheet、sheet focus／resume／inset、theme 與 shared/venue。完整 Expo lint、app／plugins TypeScript 與 `git diff --check` 通過。取消採用、舊請求、版本變更、轉接重試、抵達入口主操作及結束後返回原路線均有回歸驗證。測試紀錄：`/tmp/indoor-final-related-tests.log`。
- 使用既有 **iPhone 18 Pro（iOS 27）** 與公開 API 真實圖資完成操作：原首頁搜尋 `2201` → 原地點詳情 → 原規劃頁；將原起點搜尋改為 `2101` 後，在相同規劃面板取得資訊館 1F→2F 路線，於原導航頁完成 8 步並確認抵達。手動瀏覽 2F 不會推進步驟，按「已到 2F」才推進。
- 同一目的地保留 `2201`，將起點清回「你的位置」，選原本「步行」並開始導航；實際取得 39 分鐘／1.7 km 戶外段及 179 m／約 5 分鐘場域接續段。用模擬器定位模擬抵達已發布的三民路校門，GPS 引擎顯示抵達入口後，在同一 `/navigation` 確認繼續，完成從校門、校園步道、資訊館 1F、電梯到 2F 房間附近走廊的 15 步確認式導引。結束後回到原 39 分鐘戶外路線詳情，再返回原起訖規劃，目的地與結果保留。
- 抵達入口時，導航橫幅與收合列的主操作顯示「繼續」，不必展開面板尋找轉接操作。模擬器再次從原規劃頁開始，直接點橫幅「繼續」，已確認在同一導航頁進入校門接續段第 1／15 步；一般目的地抵達仍保留原「結束導航」。
- 本輪畫面證據保存在 `output/indoor-integrated/`：`shared-plan.png`、`outdoor-arrival.png`、`outdoor-indoor-handoff.png`、`journey-arrival.png`、`indoor-arrival.png`。這是模擬器 UI／定位及真 API 串接驗證，沒有實際走完 1.7 km，亦不代表現場坡度、門位或通行性已驗證。
- 驗收連線 `https://map.yuzen.dev` 的已發布場域資料；本次讀取開發 API 的場域清單為空，因此暫時只在隔離工作區切換測試 API。驗收後已還原原 `.env.local` 連結；來源專案保持乾淨，其他 agent 的服務未更動。未建立新模擬器。
- 未測：VoiceOver、TalkBack、Android、實機／現地導航、室內語音、自動定位／判層與進階場景效能。上述項目不能由 Jest、幾何對照或 iOS 模擬器結果推論為已通過。


## 2026-10-30 跨棟路線與資訊館出口修正

- 問題根因：原 renderer 僅保留「目前建物＋目前樓層」，因此刪掉出樓、校園戶外及另一棟的路線；此外漏掉 web 的校園道路圖層，資訊館出口看起來只剩小開口。
- 對照 web `campusDisplay`、`campusRouteSegments`、`campusRoads`、`campusRoadStyle` 與 `VenueJourneyMapSync`：同步同名樓層、保留原始跨棟相鄰邊、戶外步驟保留地面場景；道路沿用底圖樣式並裁掉建物覆蓋區，保留庭院洞，不推導新連線。
- 真 API v3 的資訊館 `2101` → 昌明樓 `4101` 輪椅路線共 14 條原始邊，修正後 14 條全部保留。校園道路兩端均為 76 個片段，分類、順序與座標一致，最大座標差為 0。證據在 `output/indoor-parity/route-validation.json`、`road-parity.json`。
- 資訊館 1F 的 5 處入口開口與 web 相同，展示寬度均為 1.6 公尺；沒有擅自放大或將展示尺寸當實測門寬。補回共用坡道、電梯 A 出口階梯與樓梯 C 出口階梯等來源道路片段。
- 五棟 1F 場景產生 1018 個有效 features，有限座標檢查通過；證據在 `output/indoor-parity/scene-validation.json`。此為幾何資料驗證，不能取代實際渲染驗收。
- 使用原有 iPhone 18 Pro（iOS 27），從首頁搜尋 `2101` → 原地點詳情設起點 → 原起訖搜尋 `4101` → 共用規劃頁（4 分鐘／約 180 公尺）→ 開始導航 → 逐步確認至第 12 步並確認抵達。出資訊館、校園戶外步道、進昌明樓與抵達 4101 均維持同一導航頁；3D 路線置於低牆圖層之上，出樓不清空 1F 場景，進樓才更新目前建物。證據：`output/indoor-parity/campus-route-2d.png`、`exit-to-campus-3d.png`、`cross-building-arrival.png`。
- 本輪操作已與另一個 chat 協調順序，未建立新模擬器。程式與證據移至 KINGSTON 的 `/Volumes/KINGSTON/yuzen/local/worktrees/accessible-smart-map-mobile-indoor`，原工作區路徑保留連結。這是公開圖資與模擬器確認式導引驗證，不代表現地通行或自動室內定位已驗證。

- iOS 原生鏡頭會先用既有俯角計算目標位置／範圍，造成從台北 3D 搜尋臺中房號時仍停在原地。已修正為必要時先平面準備，完整 bounds 先框入再恢復俯角；維持最新命令、忽略舊移動，保留導航 60°與室內 48°，處理切回 2D 的動畫窗口。原生已實測台北 3D → 資訊館 2101、完整跨棟預覽、2D／3D 切換；最終版本再次完成全部 12 步並返回原規劃，起訖保留。預覽留出上方控制項空間。另見 `output/indoor-parity/search-2101-from-taipei-3d.png`、`campus-route-3d.png`。
- 驗收完成後已停止本輪 8082 測試服務，還原 `app.json` 原 runtime policy 及 `.env.local` 原 symlink；來源專案與另一個 chat 的服務未修改。已通知該 chat 可恢復使用現有模擬器。
- 最終設定還原後完整驗證：**224 suites／2296 tests 通過**；完整 Expo lint、app／plugins TypeScript 與 `git diff --check` 通過。紀錄位於 `output/indoor-parity/final-tests.log`、`final-lint.log`、`final-types.log`。Android、實機與現地通行仍未驗證。
