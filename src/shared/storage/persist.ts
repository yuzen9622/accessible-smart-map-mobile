import { createJSONStorage, type PersistStorage, type StateStorage } from 'zustand/middleware';

import type { KeyValueStorage } from './keyValue';
import { appStorage } from './mmkv';

/** 把 KeyValueStorage 包成 zustand 的 StateStorage（同步）。 */
export function toStateStorage(storage: KeyValueStorage): StateStorage {
  return {
    getItem: (name) => storage.getString(name) ?? null,
    setItem: (name, value) => storage.set(name, value),
    removeItem: (name) => {
      storage.remove(name);
    },
  };
}

/**
 * 給 `persist(..., { storage: createPersistStorage<State>() })` 使用；
 * 取代 Web 版直接讀寫 localStorage 的 13 個檔案（SDD §7.3）。
 */
export function createPersistStorage<S>(
  storage: KeyValueStorage = appStorage,
): PersistStorage<S> | undefined {
  return createJSONStorage<S>(() => toStateStorage(storage));
}
