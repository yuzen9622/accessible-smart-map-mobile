import { useState } from 'react';
import { AccessibilityInfo, Alert } from 'react-native';

import { clearLastUserLocation, hasLastUserLocation } from '@/features/map';
import { useSavedPlacesStore } from '@/features/place';
import { useAppTranslation } from '@/shared/i18n';

/**
 * 設定 → 資料管理，對齊 Web `DataManagementPanel.tsx`（commit f82cda8）。
 * 差異：Web 清除時不確認；原生清除不可復原，改以系統確認對話框防誤觸。快捷功能在 App 內沒有自訂，這列不做。
 */
export function useDataViewModel() {
  const { t } = useAppTranslation();
  const historyCount = useSavedPlacesStore((s) => s.searchHistory.length);
  const savedCount = useSavedPlacesStore((s) => s.savedPlaces.length);
  const [hasLocation, setHasLocation] = useState(hasLastUserLocation);

  const confirm = (title: string, action: () => void, doneMessage: string) => {
    Alert.alert(title, t('nativeClearConfirm'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('nativeClear'),
        style: 'destructive',
        onPress: () => {
          action();
          AccessibilityInfo.announceForAccessibility(doneMessage);
        },
      },
    ]);
  };

  return {
    rows: [
      {
        key: 'history',
        title: t('settingsDataSearchHistoryTitle'),
        description: t('settingsDataSearchHistoryDesc'),
        status: String(historyCount),
        actionLabel: t('settingsDataClearHistory'),
        disabled: historyCount === 0,
        onPress: () =>
          confirm(t('settingsDataClearHistory'), () => useSavedPlacesStore.getState().clearSearchHistory(), t('settingsDataHistoryCleared')),
      },
      {
        key: 'saved',
        title: t('settingsDataSavedPlacesTitle'),
        description: t('settingsDataSavedPlacesDesc'),
        status: String(savedCount),
        actionLabel: t('settingsDataClearSavedPlaces'),
        disabled: savedCount === 0,
        onPress: () =>
          confirm(t('settingsDataClearSavedPlaces'), () => useSavedPlacesStore.getState().clearSavedPlaces(), t('settingsDataSavedPlacesCleared')),
      },
      {
        key: 'location',
        title: t('settingsDataLocationTitle'),
        description: t('settingsDataLocationDesc'),
        status: hasLocation ? t('settingsDataStatusStored') : t('settingsDataStatusEmpty'),
        actionLabel: t('settingsDataClearLocation'),
        disabled: !hasLocation,
        onPress: () =>
          confirm(
            t('settingsDataClearLocation'),
            () => {
              clearLastUserLocation();
              setHasLocation(false);
            },
            t('settingsDataLocationCleared'),
          ),
      },
    ],
  };
}

export type DataViewModel = ReturnType<typeof useDataViewModel>;
