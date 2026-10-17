import { router } from 'expo-router';

import { useAppTranslation } from '@/shared/i18n';
import { usePreferencesStore, type QuickActionKey } from '@/shared/preferences';

export interface QuickAction {
  key: QuickActionKey;
  label: string;
  iconName: 'sparkles' | 'bus' | 'alert' | 'trainFront';
  /** 圖示底色：每個項目各自一色，不再全部套用同一個 accentSoft（使用者回饋 2026-10-11，太單調）。 */
  color: string;
  onPress: () => void;
}

/** 快速服務每格各自一色，不再全部套用同一個 accent 藍（使用者回饋 2026-10-11：太單調）。 */
const QUICK_ACTION_COLOR: Record<QuickActionKey, string> = {
  assistant: '#7048E8',
  bus: '#0F9960',
  hazard: '#E8590C',
  train: '#1864AB',
};

/**
 * 「快速服務」（AI 助理／公車到站／回報障礙物／火車時刻）的 view-model，原本內嵌在
 * `useExploreViewModel` 裡；拆出來讓 `QuickActionsDock`（常駐浮在地圖上的捷徑列，見
 * 2026-10-17 使用者回饋：跟 Google 地圖比，捷徑被鎖在 sheet 裡才看得到）跟首頁搜尋 view-model
 * 各自呼叫，不必為了這幾顆按鈕重新掛一次 `useExploreViewModel` 的搜尋／自動完成／語音狀態。
 */
export function useQuickActions(): QuickAction[] {
  const { t } = useAppTranslation();
  const enabledQuickActions = usePreferencesStore((state) => state.quickActions);

  return enabledQuickActions
    .map((key): QuickAction | null => {
      switch (key) {
        // 公車（Phase 2）：只經 sheet 路由切換面板，place 不 import 那個 feature。
        case 'bus':
          return { key: 'bus', label: t('busInfo'), iconName: 'bus', color: QUICK_ACTION_COLOR.bus, onPress: () => router.navigate('/bus') };
        // AI 助理（Phase 4）：root modal；place 不 import ai feature
        case 'assistant':
          return {
            key: 'assistant', label: t('assistShort'), iconName: 'sparkles', color: QUICK_ACTION_COLOR.assistant,
            onPress: () => router.navigate('/chat'),
          };
        // 危險通報（Phase 3）：root modal，未登入也能送
        case 'hazard':
          return {
            key: 'hazard', label: t('reportHazard'), iconName: 'alert', color: QUICK_ACTION_COLOR.hazard,
            onPress: () => router.navigate('/hazard-report'),
          };
        // 火車／高鐵時刻（測試人員回饋 2026-10-11）：root modal，place 不 import train feature
        case 'train':
          return {
            key: 'train', label: t('nativeTrainSearchTitle'), iconName: 'trainFront', color: QUICK_ACTION_COLOR.train,
            onPress: () => router.navigate('/train'),
          };
        default:
          return null;
      }
    })
    .filter((action): action is QuickAction => action !== null);
}
