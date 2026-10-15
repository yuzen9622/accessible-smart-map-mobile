export {
  DEFAULT_PREFERENCES,
  FONT_SCALE,
  QUICK_ACTION_KEYS,
  SOS_ALARM_MODES,
  sanitizePreferences,
  type FontSizeLevel,
  type LanguagePreference,
  type Preferences,
  type QuickActionKey,
  type SosAlarmMode,
  type ThemeMode,
} from './preferences';
export { PREFERENCES_STORAGE_KEY, createPreferencesStore, usePreferencesStore, type PreferencesStore } from './preferencesStore';
export { usePreferencesEffects } from './usePreferencesEffects';
export { useFontScale } from './useFontScale';
