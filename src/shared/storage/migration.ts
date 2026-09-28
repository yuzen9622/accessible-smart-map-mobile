import type { KeyValueStorage } from './keyValue';

export interface VersionedWrite {
  /** 本次要寫入的所有 key（值已序列化） */
  entries: Record<string, string>;
  versionKey: string;
  version: string;
}

/**
 * 移植 Web `client-layout.tsx` 的 place schema 遷移規則：
 * 先寫完所有資料 key，**最後**才寫版本號；任一寫入失敗就把所有 key（含版本號）還原成寫入前的值再拋出，
 * 確保不會出現「版本號已升級、資料卻只寫一半」的狀態。
 */
export function commitVersionedWrite(storage: KeyValueStorage, write: VersionedWrite): void {
  const keys = [...Object.keys(write.entries), write.versionKey];
  const snapshot = new Map(keys.map((key) => [key, storage.getString(key)]));
  try {
    for (const [key, value] of Object.entries(write.entries)) {
      storage.set(key, value);
    }
    storage.set(write.versionKey, write.version);
  } catch (error) {
    try {
      for (const [key, value] of snapshot) {
        if (value === undefined) storage.remove(key);
        else storage.set(key, value);
      }
    } catch {
      // 儲存空間不足時還原也可能失敗；仍拋出原始錯誤
    }
    throw error;
  }
}

/** 安全讀取 JSON；不存在或損毀時回傳 fallback（不改動儲存內容）。 */
export function readJson<T>(
  storage: KeyValueStorage,
  key: string,
  isValid: (value: unknown) => value is T,
  fallback: T,
): T {
  const raw = storage.getString(key);
  if (raw === undefined) return fallback;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isValid(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}
