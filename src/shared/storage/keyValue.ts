/** 同步 key-value 儲存的最小介面。MMKV 實例符合此介面；測試用 createMemoryStorage。 */
export interface KeyValueStorage {
  getString(key: string): string | undefined;
  set(key: string, value: string): void;
  remove(key: string): boolean;
  contains(key: string): boolean;
}

export function createMemoryStorage(initial: Record<string, string> = {}): KeyValueStorage {
  const map = new Map(Object.entries(initial));
  return {
    getString: (key) => map.get(key),
    set: (key, value) => {
      map.set(key, value);
    },
    remove: (key) => map.delete(key),
    contains: (key) => map.has(key),
  };
}
