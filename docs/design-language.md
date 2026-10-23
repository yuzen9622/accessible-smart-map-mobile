# 設計語言：Apple 的骨架、自己的皮膚

> 狀態：提案（2026-10-22）。評估依據是 iOS 模擬器（iPhone 18 Pro／iOS 27，大字級）實際截圖與 `src/` 全面掃描。
> 本文件定規則；token 的值仍以 `src/shared/theme/tokens.ts` 為唯一來源，落地後本文件只引用、不重複。

## 0. 一句話原則

**行為與結構交給系統，品牌只出現在四個地方：一個主色、Lucide 圖示、圓體數字、路線線條。**

| 交給 Apple（不要自己做） | 屬於我們（品牌層） |
| --- | --- |
| 常駐 formSheet 與 detent、native stack push、modal、返回手勢 | 單一「路線藍」主色 |
| `@expo/ui` 的 SwiftUI 控制項（Button、Picker、Switch、Form） | Lucide 圖示 + 統一的視覺粗細規則 |
| 地圖上浮動元件的 Liquid Glass（`GlassCard`） | 時間／距離／分鐘數用 `ui-rounded` 圓體數字 |
| 系統字（PingFang TC／SF Pro）與 Dynamic Type 倍率 | 「路線時間軸」：步行虛線、乘車實線的線條語言 |
| 畫面轉場的時長與曲線 | 少數幾個簽名動畫（路線繪出、即時脈動、抵達） |

判斷一個元件該不該自訂：**如果 Apple 地圖／Apple 錢包裡有同樣角色的元件，就照它的行為做，只換顏色與圖示。**

---

## 1. 現況評估（為什麼感覺不統一）

數字取自 `src/`（排除測試）掃描：

| 面向 | 現況 | 問題 |
| --- | --- | --- |
| 色碼 | **92 種**寫死 hex；出現次數 route 48、place 26、bus 23、map 19 處 | 已有 `tokens.ts`，但地圖圖層與 domain 常數繞過它 |
| 藍色 | `#0065C8`（主色）、`#3C70FC`（splash／icon）、`#1565C0`（設施群集）、`#2563EB`、`#3B82F6`、`#1D4ED8`、`#1864AB`、`#3949AB` | 同一個 App 有 8 種藍；splash 的 `#3C70FC` 配白字對比約 4.3:1，不到 AA |
| 紅色 | `#EA4335`（地點 pin，是 Google 紅）、`#E53935`、`#EF4444`、`#DC2626`、`#C62828`、`#C02020`、`#E03131` | 7 種紅 |
| 字級 | 116 處 `fontSize` 字面值（.tsx）、15 種大小（12–64） | `TYPE` 有 201 處使用，但另有一半繞過 |
| 字重 | `500`／`600`／`700`／`800` 四種混用 | 沒有角色對應 |
| 圓角 | **25 種** `borderRadius`（2.5–36，另有 999 膠囊） | `RADIUS` 只定義 3 階 |
| 陰影 | 12 處舊式 `shadowColor` + 14 處 `elevation` | 應改 `boxShadow` token |
| 按壓回饋 | opacity 0.5／0.6／0.7／0.8／0.85／0.9 六種，6 處 Android ripple，scale 只有班次卡一處（`BusDepartureChooserBase.tsx:129`） | 每個元件各寫各的 |
| 動畫時長 | 160–900ms 共 15 種；曲線混用 `out(quad)`、`out(cubic)`、`in(quad)`、bezier | 有一處 `Easing.in`（UI 上不該用） |
| 圖示 | Lucide 預設 strokeWidth 2，呼叫端另傳 5 種值；尺寸 11–40 共 17 種 | 14px 顯得粗、28px 顯得細，與旁邊文字字重不搭 |

### 1.1 截圖觀察（逐畫面）

- **首頁地圖**：浮在地圖上的元件有 5 種外觀——環境 chip（白底陰影）、路線 pill（玻璃）、定位／3D 鈕（白圓＋陰影、非玻璃）、SOS（紅實心）、設施 pills（半透明藍字）。設施 pills 的藍字直接壓在地圖標記上難以閱讀；**SOS 按鈕與「停車」pill 重疊**（地圖 inset 改變時）。
- **地圖標記**：深藍 `P` 停車點數量最多也最搶眼，真正的主角（無障礙設施、路線）反而被淹沒；設施群集是第 9 種藍。
- **首頁快速服務**：AI 紫、公車綠、回報橘三個實心圓——但進到 AI 聊天頁，圖示變成藍色；公車到站頁的公車圖示也是藍色。**同一個功能在入口與內頁顏色不同。**
- **公車路線號碼**：在路線規劃是「綠底白字」，在公車到站列表是「淡藍底藍字」。同一個實體兩種顏色。
- **路線規劃**：「一般／輪椅／長者／視障」是白色 thumb 的分段控制；下一列交通方式卻是「淡藍底藍字」的選中樣式——相鄰兩個選擇器兩種語言。
- **選中狀態**：路線卡選中是藍框；班次卡選中是**綠框＋藍底**。選中顏色不一致。
- **地點詳情**：導覽列標題與內文大標題重複（「臺鐵便當」出現兩次）；三個圓形淡藍圖示鈕沒有文字標籤。
- **Splash**：`#3C70FC` 亮藍，進 App 後主色是 `#0065C8` 深藍，品牌色在第一秒就斷開。

沒在本次模擬器上看到的：高鐵／台鐵頁、導航 HUD（`c349050` 剛重做）、設定頁。以下對它們的建議只根據程式碼。

---

## 2. 色彩系統

四層，**每層只做一件事，層與層不互借**：

### 2.1 中性層（系統）

沿用 `Colors`（已通過 `contrast.test.ts` 的 AA／AAA）。不改用 `PlatformColor`：App 內有自己的高對比開關，且 Reanimated 不能吃 opaque color。iOS 的 `secondaryLabel` 對白底只有約 3.4:1，對無障礙 App 不夠，`#60646C` 是正確的選擇。

### 2.2 品牌層：路線藍

| token | 淺色 | 深色 | 用途 |
| --- | --- | --- | --- |
| `accent` | `#0065C8` | `#6BB2FF` | 文字、圖示、**選中狀態**、連結 |
| `ACCENT_FILL` | `#0065C8` | `#0065C8` | 實心主要按鈕 |
| `accentSoft` | 12% | 18% | 選中底色、tinted 按鈕 |

規則：**選中／焦點永遠是 accent**（2pt accent 外框 + accentSoft 底）。不論是路線卡、班次卡、交通方式、篩選 chip。

> 待決定：splash 與 App icon 的 `#3C70FC`。建議改成 `#0065C8`（或以它為底的漸層），讓第一秒就是同一個藍。這動到 App icon，是品牌決定。

### 2.3 語意層（狀態）

`ok`／`warn`／`danger`／`neutral`，沿用 `tokens.ts`。只表達狀態（即時、誤點、停駛、未確認），**不拿來當分類色**。`bus/components/palette.ts` 的 `arriving`／`ok`／`normal` 應直接轉出這層，而不是另抄一份 hex。

### 2.4 領域層（分類），集中到新增的 `shared/theme/palettes.ts`

| palette | 內容 | 規則 |
| --- | --- | --- |
| `MODE` 交通方式 | 步行、公車、捷運、高鐵、台鐵、開車、機車 | 每項給 `line`（地圖線）與 `text`（AA 文字色）兩值。**步行改為中性灰虛線**（Apple 地圖慣例），不再用藍，避免與主色、途經點撞色 |
| `FACILITY` 設施 | 電梯、坡道、廁所、停車、群集 | 地圖標記、篩選 pill、附近列表、詳情頁共用同一組值。群集改中性深灰，不再是第 9 種藍 |
| `FEATURE` 功能識別 | AI、公車、高鐵台鐵、危險通報、SOS | 只用在**圖示底板**（首頁磚、內頁標頭圖示、地圖上該功能的標記）。AI 首頁紫，內頁也紫；公車首頁綠，內頁也綠 |

**實體顏色規則**：同一個實體在任何地方顏色相同。公車路線號碼一律是 `MODE.bus`；「要搭的那一班」用實心，「列表裡的候選」用 tinted（12% 底 + `text` 色）。

---

## 3. 字體

### 3.1 對齊 iOS Text Styles

`TYPE` 現在 body 是 16pt，Apple 是 17pt。改成 Apple 的相對關係，並把 120+ 處字面值收進來：

| token | pt | 字重 | 用途 |
| --- | --- | --- | --- |
| `largeTitle` | 34 | bold | 面板大標（規劃路線、建議路線不要用這個） |
| `title1` | 28 | bold | 地點名、路線總時間 |
| `title2` | 22 | bold | 區塊標題 |
| `title3` | 20 | semibold | 卡片大數字旁的標題 |
| `headline` | 17 | semibold | 列表主文字、按鈕 |
| `body` | 17 | regular | 內文 |
| `callout` | 16 | regular | 卡片內次要內文 |
| `subhead` | 15 | regular | 地址、說明 |
| `footnote` | 13 | regular | 時間戳、資料來源 |
| `caption` | 12 | semibold | badge、chip |

字重只剩三種：regular 400、semibold 600、bold 700。移除 500 與 800。

### 3.2 品牌簽名：圓體數字

時間、分鐘數、距離、班次倒數、車次號一律用：

```ts
{ fontFamily: 'ui-rounded', fontVariant: ['tabular-nums'], fontWeight: '700' }
```

RN 0.86 在 iOS 支援 `ui-rounded`（`RCTFontUtils.mm` 對應到 `UIFontDescriptorSystemDesignRounded`）。中文字仍會落回 PingFang，所以「29 分」是圓體的 29 + 一般的「分」——這正是交通看板的質感，也是不需要買字型的品牌辨識。Android 沒有對應的系統圓體，維持預設字。

做成 `shared/ui/typography` 的 `<Numeral>` 元件，不要在各 feature 手寫這組樣式。

---

## 4. 形狀、間距、陰影

| token | 值 | 用途 |
| --- | --- | --- |
| `RADIUS.badge` | 6 | 路線號碼、小標籤 |
| `RADIUS.control` | 10 | 輸入框內元件、分段控制的 thumb |
| `RADIUS.card` | 16 | 卡片、群組列表 |
| `RADIUS.floating` | 22 | 地圖上的玻璃卡片（沿用 `GlassCard`） |
| `RADIUS.pill` | 999 | 膠囊按鈕、chip |

全部搭配 `borderCurve: 'continuous'`（現在整個 `src/` 只有 1 處用到）。

陰影只剩兩階，用 `boxShadow`：

| token | 值 | 用途 |
| --- | --- | --- |
| `ELEVATION.floating` | `0 4px 12px rgba(0,0,0,0.16)` | 地圖上浮動元件的不透明退化版 |
| `ELEVATION.raised` | `0 1px 3px rgba(0,0,0,0.10)` | 分段控制 thumb、卡片內被選中的 tile |

sheet 內的卡片**不要陰影**，用 `backgroundElement` 底色分層（Apple 的 grouped 樣式）。

---

## 5. 圖示（Lucide）

保留 Lucide，但讓它像系統圖示一樣跟文字搭：

1. **尺寸只有 5 階**，對齊旁邊文字：`14`（caption）、`17`（body／headline）、`20`（按鈕）、`24`（地圖控制、標頭）、`28`（功能磚）。
2. **視覺粗細固定**：在 `Icon` 內依尺寸換算 `strokeWidth`，讓所有尺寸的線條看起來一樣粗——`≤14 → 2.25`、`17–20 → 2`、`24 → 1.85`、`≥28 → 1.75`。呼叫端不再傳 `strokeWidth`（現在 `<Icon>` 上有 5 種覆寫值）。
3. **顏色只有三種來源**：跟著文字色、`accent`、或所在底板的前景色（功能磚上一律白色）。
4. 功能磚圖示：`FEATURE` 色實心圓角方形（`RADIUS.control`），不是圓形——圓形留給地圖上的單一動作按鈕，避免兩種角色長一樣。

---

## 6. 互動回饋

### 6.1 按壓：一個元件、兩種行為

新增 `shared/ui/PressableScale`（三檔元件），取代各自寫的按壓樣式（139 個 `<Pressable>`，其中 56 處是 `pressed && styles.pressed`）：

| 行為 | 適用 | 規格 |
| --- | --- | --- |
| `scale` | 有邊界的物件：按鈕、卡片、chip、功能磚、地圖控制、班次卡 | 按下即 `scale 0.97`，120ms，`cubicBezier(0.23, 1, 0.32, 1)`；Reanimated CSS transition（UI thread） |
| `highlight` | 滿版列表列：附近站牌、搜尋結果、設定列 | 按下即換 `backgroundElement` 底色，放開 200ms 淡出；不縮放（整列縮放會像整個畫面在擠壓） |

- 回饋在 press-in，動作在 press-out。
- 不足 44pt 的視覺加 `hitSlop`，不放大外觀。
- Android 也用同樣的 scale，不用 ripple（這是自訂設計的 App）；`@expo/ui` 的 Compose 控制項保留它自己的回饋。
- 已經是 `@expo/ui` SwiftUI 的按鈕（`Button.ios.tsx`、`FormPrimaryButton.ios.tsx`）不包，系統自己有。

### 6.2 觸覺回饋

集中成 `shared/haptics`，以語意命名，各 feature 不直接呼叫 `expo-haptics`：

| API | 時機 | 實作 |
| --- | --- | --- |
| `haptic.select()` | 切換交通方式、行動需求、選班次、分段控制 | `selectionAsync` |
| `haptic.commit()` | 開始導航、儲存地點、送出評論 | `impactAsync(Light)` |
| `haptic.success()` | 抵達目的地、通報送出成功 | `notificationAsync(Success)` |
| `haptic.warning()` | 偏離路線重新規劃、末班車警示 | `notificationAsync(Warning)` |
| `haptic.error()` | 規劃失敗、送出失敗 | `notificationAsync(Error)` |
| `haptic.sos(tick)` | SOS 倒數 | 沿用現有 Heavy／Light |

一個使用者動作最多一次；和視覺同一幀；永遠不是唯一回饋。原生 `Switch`、Picker 自帶觸覺，不要重複。

---

## 7. 動態

### 7.1 Motion tokens（新增 `shared/theme/motion.ts`）

| token | 值 | 用途 |
| --- | --- | --- |
| `MOTION.press` | 120ms，ease-out | 按壓 |
| `MOTION.small` | 180ms，ease-out | chip、toggle、數字滾動 |
| `MOTION.medium` | 240ms，ease-out | 展開／收合、內容替換、淡入 |
| `MOTION.move` | 280ms，`(0.77, 0, 0.175, 1)` | 畫面上的位移（選中框移動） |
| `MOTION.settle` | spring `{ duration: 400, dampingRatio: 1 }` | 無手勢的歸位 |
| `MOTION.snap` | spring `{ duration: 300, dampingRatio: 0.8, velocity }` | 手勢放開後的吸附 |
| `MOTION.camera` | 600ms（`easeTo`）／系統預設（`flyTo`） | 地圖鏡頭 |
| `MOTION.ambient` | 1600ms 循環 | 即時脈動、思考中 |

曲線只有 ease-out、ease-in-out、linear（進度）。移除唯一的 `Easing.in(Easing.quad)`（`VoiceModeView.tsx:160`）。每個動畫都帶 `ReduceMotion.System`：降低動態時保留透明度與顏色變化，拿掉位移、縮放、回彈。

### 7.2 哪些該動、哪些不該動

| 互動 | 頻率 | 決定 |
| --- | --- | --- |
| 分段控制、交通方式切換 | 每次使用多次 | **不加動畫**，只有原生 thumb 移動與 `haptic.select()` |
| 鍵盤、捲動、清單捲動 | 極高 | 不加 |
| 按壓 | 高 | 120ms scale／highlight |
| 面板之間 push／back | 中 | native stack 預設，**不覆寫** |
| sheet detent | 中 | UIKit 原生，不碰 |
| 聊天、設定、高鐵台鐵、通報 | 中 | `presentation: 'modal'` 原生 |
| 路線卡選中框 | 中 | 框線顏色 180ms 過渡 |
| 展開步行細節 | 中 | `LinearTransition` + 內容 `FadeIn` 240ms |
| 載入 → 內容 | 中 | skeleton 淡出 / 內容淡入 240ms，不滑動 |
| 列表首次出現 | 低 | 不做逐項 stagger（虛擬化列表上 `entering` 也不安全） |

### 7.3 簽名動畫（品牌的「喜悅預算」，只花在少數時刻）

1. **路線繪出**：規劃完成第一次顯示路線時，鏡頭 `fitBounds` + 路線從起點往終點畫出（約 600ms），之後切換路線只淡入淡出。每次規劃一次。
2. **即時脈動**：「即時」班次的小圓點以 `MOTION.ambient` 呼吸（opacity 1 → 0.35），只有點，不是整列。降低動態時改成靜態點。
3. **開始導航**：sheet 收成行程列 + 鏡頭傾斜進入跟隨模式（Apple 地圖的連貫轉場），配 `haptic.commit()`。現有程式已接近，只需統一時長。
4. **抵達**：勾勾 `ZoomIn`（從 0.9 起，不從 0）+ `haptic.success()`。
5. **AI 思考軌跡**：沿用 `ThinkingTrace`，把裡面的 `damping(12)` 改成 `MOTION.settle`、時長改用 token。

---

## 8. 浮在地圖上的元件

全部走 `GlassCard`（Liquid Glass；不支援、降低透明度或高對比時退化成 `background` + `ELEVATION.floating`）：

| 元件 | 形狀 | 內容色 |
| --- | --- | --- |
| 環境 chip、路線 pill、設施篩選 pills | 膠囊，高 44 | label 色；選中的篩選用 accent 文字 + accentSoft |
| 定位、3D、圖層 | 圓，48 | label 色 |
| SOS | 圓，56，**唯一實心色** | 白字 on `DANGER_FILL` |

- 浮動元件之間的位置要互相避讓：SOS 與設施 pills 現在會重疊，應由同一個 layout 計算（pills 列右側留出 SOS 的寬度，或 SOS 固定在控制鈕那一欄）。
- 地圖標記：主角是無障礙設施與路線。停車點縮小、降低飽和度，或改成 zoom ≥ 16 才顯示；群集改中性色；選中的地點 pin 從 Google 紅改成 `danger` 系。

---

## 9. 各功能的落地重點

| 功能 | 要改的 |
| --- | --- |
| 路線規劃 | 交通方式選擇器改成與行動需求同一種分段樣式（或 Apple 地圖式的圖示＋文字 chip，選中統一 accent）；路線卡大數字換 `<Numeral>`；班次卡選中改 accent 框，移除綠框藍底 |
| 路線詳情 | 時間軸是品牌主視覺：步行灰虛線、乘車 `MODE.line` 實線，同一組元件給導航步驟、公車經過站、台鐵停靠站共用 |
| 公車到站 | 路線號碼 badge 改 `MODE.bus` tinted；站牌圖示改 `FEATURE.bus` 底板；倒數用 `<Numeral>`；「即時」用脈動點 |
| 高鐵／台鐵 | 車次、時刻用 `<Numeral>`；停靠站沿用時間軸元件；高鐵／台鐵用 `MODE` 色 |
| AI 助理 | 聊天頁空狀態圖示、建議 chip 圖示、地圖上 AI 結果標記改用 `FEATURE.ai`，與首頁磚一致 |
| 導航 | HUD 距離數字用 `<Numeral>`；結束、改道等按鈕走 `PressableScale`；改道配 `haptic.warning()` |
| 地點詳情 | 導覽列標題在大標題捲出畫面後才出現；動作列改成等寬、有文字標籤的 tinted 按鈕（主要動作實心） |
| 首頁 | 功能磚改圓角方形底板；設施 pills 走 `GlassCard` |

---

## 10. 落地順序

每一步都能單獨驗證、單獨 commit：

1. **基礎 token**：`palettes.ts`（MODE／FACILITY／FEATURE）、`motion.ts`、擴充 `TYPE`／`RADIUS`／`ELEVATION`、`shared/haptics`、`<Numeral>`、`PressableScale`、`Icon` 的視覺粗細規則。加一個 jest 測試掃描 `src/`：`shared/theme` 以外出現 hex 色碼就失敗（白名單只放 MapLibre 的 `#FFFFFF` 描邊），用結構擋住回退。
2. **地圖浮動元件**：統一 `GlassCard`、修 SOS 重疊、標記配色。
3. **選擇與實體顏色**：路線規劃兩個選擇器、班次卡、路線號碼 badge。
4. **逐功能換皮**：公車 → 高鐵台鐵 → AI → 地點詳情 → 首頁。
5. **簽名動畫**：路線繪出、即時脈動、抵達。

每一步的驗收：模擬器截圖（一般字級與最大字級、淺色與深色、高對比各一張）、`npm run typecheck`、`npm run lint` 零錯誤零警告；動畫另外在實機 release build 上確認手感（模擬器不算）。
