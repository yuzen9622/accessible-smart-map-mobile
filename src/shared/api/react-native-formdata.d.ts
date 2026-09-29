/**
 * React Native 的 `FormData.append` 接受 `{ uri, name, type }` 檔案描述，由原生網路層讀檔後以 multipart 上傳
 * （RN `Libraries/Network/FormData.js`）。tsconfig 用 DOM lib，DOM 型別只允許 `string | Blob`，
 * 這裡以宣告合併補上 RN 實際支援的 overload，避免在呼叫端轉型。
 */
interface ReactNativeFormDataFile {
  uri: string;
  name: string;
  type: string;
}

interface FormData {
  append(name: string, value: ReactNativeFormDataFile): void;
}
