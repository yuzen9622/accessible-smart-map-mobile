/**
 * 全 App 統一的診斷輸出。開發版轉給 console；正式版不輸出——錯誤物件可能夾帶 token、
 * email 或位置，不能出現在裝置 log。之後若導入崩潰回報，只需改這裡。
 */
type LogArgs = readonly unknown[];

function write(sink: (...args: LogArgs) => void, args: LogArgs): void {
  if (__DEV__) sink(...args);
}

export const logger = {
  warn: (...args: LogArgs): void => write(console.warn, args),
  error: (...args: LogArgs): void => write(console.error, args),
};
