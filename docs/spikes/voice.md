# Spike B — 語音即時 PCM（R1）

| 項目 | 內容 |
|---|---|
| 日期 | 2026-09-26 |
| 環境 | `react-native-audio-api` 0.13.6、iOS 27 模擬器（Mac 麥克風） |
| 程式 | `src/features/spikes/voice/`（`pcm.ts` 有單元測試）、路由 `/spikes/voice` |
| 結論 | **採用 `react-native-audio-api`，擷取與播放同一個套件**（ADR-06 定案）。音質（抗混疊、爆音、變調）與後端實連仍需真機驗證 |

## 候選比較（原始碼審閱，npm 套件 `expo-audio@57.0.5`、`react-native-audio-api@0.13.6`）

| | `expo-audio` `useAudioStream` | `react-native-audio-api` `AudioRecorder.onAudioReady` |
|---|---|---|
| iOS 重取樣 | `AVAudioConverter`（Apple 預設品質）；建立失敗時**靜默退回不轉換**（`ios/AudioStream.swift:62-72`） | `AVAudioConverter`，明確設 `AVAudioQualityMax`（`IOSRecorderCallback.mm:75-79`） |
| Android 重取樣 | **無**，直接以要求的取樣率開 `AudioRecord`，品質取決於系統 HAL（`AudioStream.kt:141-147`） | miniaudio `ma_data_converter`（線性＋低通濾波，非 sinc；`AndroidRecorderCallback.cpp:57-66`） |
| 固定 1600 frame | iOS 不保證（buffer 大小只是提示），需在 JS 重切 | 兩平台皆以環形緩衝湊滿 `bufferLength` 才發事件 |
| PCM 佇列播放 | **沒有**（`AudioPlayer` 只吃檔案／URL） | `AudioBufferQueueSourceNode`（enqueue／clearBuffers／onBufferEnded） |
| iOS audio session | 串流路徑固定 `.record` + `.measurement`，不能用 `voiceChat` 回音消除 | `AudioManager.setAudioSessionOptions`：`playAndRecord`、`voiceChat`、藍牙 |

→ `expo-audio` 缺播放 API 且 session 模式無法做回音消除，淘汰。

## 實測（iOS 模擬器）

| 項目 | 結果 |
|---|---|
| `onAudioReady({ sampleRate: 16000, bufferLength: 1600, channelCount: 1 })` | ✅ 每次事件 `buffer.sampleRate=16000`、`numFrames=1600`、1 聲道、`Float32Array` |
| 即時性 | ✅ 19.2 s 內 158 個 frame；扣掉啟動約 3.35 s 後為 **9.97 frames/s**（協定要求 10/s，每 frame 100 ms） |
| Float32 → PCM16 LE | ✅ 每 frame 3200 bytes（協定單 frame 上限 64 KB）；轉換與重切 frame 的純函式見 `pcm.ts`＋`__tests__/pcm.test.ts` |
| `AudioContext({ sampleRate: 24000 })` + 佇列播放 20 個不等長 chunk（60–240 ms，共 3.00 s） | ✅ 最後一個 `onBufferEnded` 在 3,025 ms，無明顯間隙 |
| 打斷（`clearBuffers()` + `stop()`） | ✅ 打斷後剩餘 chunk 不再觸發 `onBufferEnded` |
| iOS session `playAndRecord` + `voiceChat` + `allowBluetoothHFP` + `defaultToSpeaker` | ✅ 設定不報錯（回音消除效果需真機聽） |

## 已知問題與設定

1. **0.13.6 bug**：`AudioBufferQueueSourceNode.start()` 預設 `offset=-1`，卻又拒絕負值而丟 `RangeError`（`src/core/AudioBufferQueueSourceNode.ts:40-49`）。必須寫 `start(0, 0)`。升版時確認是否已修。
2. 啟動約 3.35 s（權限＋session 啟用＋錄音啟動，模擬器數字）。Phase 4 要在真機量，必要時預先啟用 session。
3. config plugin 預設會開 iOS `UIBackgroundModes: audio` 與 Android 前景服務；已在 `app.json` 明確關閉（SDD Q4：v1 語音助理只在前景）、`disableFFmpeg: true`（不需解碼檔案）。
4. 測試注意：`xcrun simctl privacy ... grant microphone` 會把 App 終止。

## 未驗證（需真機，未繳年費前可用 Android 真機或免費帳號裝 iPhone）

- 44.1／48 kHz 硬體錄音轉 16 kHz 的抗混疊品質（用已知頻率測試音做頻譜檢查）
- 連續對話 5 分鐘無爆音、無變調；回音消除
- 連 `wss://…/api/v1/voice/ws` 完成一次對話：需要登入 token（`session.start` 第一個訊息要帶 token），auth 在 Phase 3，因此移到 Phase 4 開頭做
- Android 的 miniaudio 重取樣音質
