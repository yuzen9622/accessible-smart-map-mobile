import { createMMKV } from 'react-native-mmkv';

import type { KeyValueStorage } from './keyValue';

/**
 * App 一般資料（收藏、搜尋紀錄、偏好、快取）。同步讀取，zustand persist 啟動時不會閃爍。
 * 憑證不要放這裡，改用 secure.ts。
 */
export const appStorage: KeyValueStorage = createMMKV({ id: 'app' });
