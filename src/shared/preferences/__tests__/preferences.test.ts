import { createMemoryStorage } from '@/shared/storage';

import { DEFAULT_PREFERENCES, sanitizePreferences } from '../preferences';
import { PREFERENCES_STORAGE_KEY, createPreferencesStore } from '../preferencesStore';

describe('sanitizePreferences', () => {
  it('returns defaults for garbage', () => {
    expect(sanitizePreferences(null)).toEqual(DEFAULT_PREFERENCES);
    expect(sanitizePreferences('x')).toEqual(DEFAULT_PREFERENCES);
  });

  it('keeps valid fields and replaces invalid ones', () => {
    expect(
      sanitizePreferences({ themeMode: 'dark', highContrast: true, fontSize: 'huge', language: 'fr', memoryEnabled: false }),
    ).toEqual({ ...DEFAULT_PREFERENCES, themeMode: 'dark', highContrast: true, memoryEnabled: false });
  });

  it('keeps a valid, deduped quickActions subset in its given order', () => {
    expect(sanitizePreferences({ quickActions: ['hazard', 'bus', 'hazard'] }).quickActions).toEqual(['hazard', 'bus']);
  });

  it('falls back to every quick action when the stored list is garbage or empty', () => {
    expect(sanitizePreferences({ quickActions: 'nope' }).quickActions).toEqual(DEFAULT_PREFERENCES.quickActions);
    expect(sanitizePreferences({ quickActions: ['not-a-key'] }).quickActions).toEqual(DEFAULT_PREFERENCES.quickActions);
    expect(sanitizePreferences({ quickActions: [] }).quickActions).toEqual(DEFAULT_PREFERENCES.quickActions);
  });
});

describe('preferences store persistence', () => {
  it('hydrates synchronously from storage and sanitizes the stored value', () => {
    const storage = createMemoryStorage();
    storage.set(PREFERENCES_STORAGE_KEY, JSON.stringify({ state: { themeMode: 'light', fontSize: 'large', language: 'xx' }, version: 0 }));
    const store = createPreferencesStore(storage);
    expect(store.getState().themeMode).toBe('light');
    expect(store.getState().fontSize).toBe('large');
    expect(store.getState().language).toBe('system');
  });

  it('writes changes back to storage', () => {
    const storage = createMemoryStorage();
    const store = createPreferencesStore(storage);
    store.getState().setPreferences({ highContrast: true });
    expect(storage.getString(PREFERENCES_STORAGE_KEY)).toContain('"highContrast":true');
  });
});
