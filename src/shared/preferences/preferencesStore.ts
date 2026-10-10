import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { appStorage, createPersistStorage, type KeyValueStorage } from '@/shared/storage';

import { DEFAULT_PREFERENCES, sanitizePreferences, type Preferences } from './preferences';

export const PREFERENCES_STORAGE_KEY = 'preferences.v1';

interface PreferencesActions {
  setPreferences: (patch: Partial<Preferences>) => void;
  resetPreferences: () => void;
}

export type PreferencesStore = Preferences & PreferencesActions;

/** 測試可注入記憶體儲存；App 內一律用 `usePreferencesStore`（MMKV，同步 hydrate、不閃爍）。 */
export function createPreferencesStore(storage: KeyValueStorage = appStorage) {
  return create<PreferencesStore>()(
    persist(
      (set) => ({
        ...DEFAULT_PREFERENCES,
        setPreferences: (patch) => set(patch),
        resetPreferences: () => set(DEFAULT_PREFERENCES),
      }),
      {
        name: PREFERENCES_STORAGE_KEY,
        storage: createPersistStorage<Preferences>(storage),
        partialize: (state) => ({
          themeMode: state.themeMode,
          highContrast: state.highContrast,
          fontSize: state.fontSize,
          language: state.language,
          notifications: state.notifications,
          memoryEnabled: state.memoryEnabled,
          quickActions: state.quickActions,
        }),
        merge: (persisted, current) => ({ ...current, ...sanitizePreferences(persisted) }),
      },
    ),
  );
}

export const usePreferencesStore = createPreferencesStore();
