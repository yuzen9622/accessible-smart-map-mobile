# Spike C — 原生 sheet 與玻璃效果（ADR-05、ADR-15）

| 項目 | 內容 |
|---|---|
| 日期 | 2026-09-26 |
| 環境 | Expo Router ~57.0.23、`@expo/ui` ~57.0.20、iOS 27 模擬器 |
| 程式 | `src/app/spikes/_layout.tsx`（formSheet 設定）、`src/app/spikes/sheet/*`、`src/features/spikes/sheet/*` |
| 結論 | **iOS 採用 Expo Router `formSheet`**，不需要 `@expo/ui` `BottomSheet` 備案；Android 待驗 |

## 設定

```tsx
<Stack.Screen
  name="sheet"
  options={{
    presentation: 'formSheet',
    sheetAllowedDetents: [0.25, 0.5, 1],
    sheetInitialDetentIndex: 0,
    sheetLargestUndimmedDetentIndex: 1,
    sheetGrabberVisible: true,
    gestureEnabled: false,
  }}
/>
```

sheet 本身是一個巢狀 `Stack`（`app/spikes/sheet/_layout.tsx`），面板之間 `router.push`。

## 驗證結果（iOS 模擬器實測）

| 項目 | 結果 |
|---|---|
| 低 detent（0.25、0.5）時地圖不變暗、可拖曳 | ✅ |
| 三段 detent 拖曳切換 | ✅ |
| 常駐：`gestureEnabled: false` 後大力下滑只會回到最低 detent，不會關閉 | ✅ |
| sheet 內 push／back（原生返回鍵為 Liquid Glass 膠囊，帶上一頁標題） | ✅ |
| iOS 26+ 外觀：浮起、內縮圓角的系統 sheet 樣式，深淺色自動切換 | ✅（系統預設行為，不需額外設定） |
| `@expo/ui` 元件在 sheet 內：`Form`／`Section`／`LabeledContent`／`Picker`（segmented）／`DisclosureGroup`／`Toggle`／`List`／`Label`（SF Symbols） | ✅ 皆正常互動 |
| `Button` + `buttonStyle('glassProminent')` | ⚠️ 可顯示，但 `systemImage` 圖示沒出現、文字偏移；正式使用前要查 `labelStyle`／frame 設定 |

## Phase 1 要處理

1. 地圖上的浮動按鈕目前不會跟著 sheet 高度移動；需要讀 sheet 目前 detent（Expo Router 是否提供 detent 變化事件未核實），或把按鈕改放進 sheet 上緣的 toolbar。
2. `SheetController`（SDD §4.3）改為包裝 router：`open(mode)` → `router.push('/(sheet)/<mode>')`。
3. Android formSheet 的行為（detent、不變暗、禁止關閉）尚未驗證；不足時依 ADR-05 評估 `@gorhom/bottom-sheet`。
