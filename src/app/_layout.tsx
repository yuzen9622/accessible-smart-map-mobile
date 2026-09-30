import { DarkTheme, DefaultTheme, Stack, ThemeProvider, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useColorScheme, useWindowDimensions } from 'react-native';

import { useAiBootstrap } from '@/features/ai';
import { useAuthBootstrap } from '@/features/auth';
import {
  SHEET_UNDIMMED_DETENT_INDEX,
  sheetBottomInset,
  sheetConfig,
  sheetController,
  useMapUiStore,
} from '@/features/map';
import { useNavStore } from '@/features/navigation';
import { useNotificationsBootstrap } from '@/features/notifications';
import { useSettingsSync } from '@/features/settings';
import { selectSosInProgress, useSosBootstrap, useSosStore } from '@/features/sos';
import { ConfigErrorScreen, appConfigResult } from '@/shared/config';
import { useAppTranslation } from '@/shared/i18n';
import { usePreferencesEffects } from '@/shared/preferences';
import { HeaderCloseButton } from '@/shared/ui';
// 背景定位任務必須在 JS 頂層定義（App 從背景被喚醒時要找得到）
import '@/shared/location/backgroundLocation';

// 深層連結（例如 accessiblesmartmap://place/123）直接開 sheet 路由時，底下仍要有地圖。
export const unstable_settings = { initialRouteName: 'index' };

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const { height } = useWindowDimensions();
  const setSheetInset = useMapUiStore((state) => state.setSheetInset);
  // 導航中 sheet 只到 half：full 會蓋住 HUD（SDD §4.5：HUD 與 sheet 互斥，sheet 收為步驟清單入口）
  const isNavigating = useNavStore((state) => state.isNavigating);
  // 點到地點（詳情頁）時 sheet 落在 half、不給 full；換 allowed detents 時 sheet 會重新落在
  // initialDetentIndex，但不會發 sheetDetentChange：同步地圖 inset。
  const pathname = usePathname();
  const { detents, initialDetentIndex } = sheetConfig(isNavigating, pathname);
  useEffect(() => {
    if (!sheetController.available) {
      setSheetInset(sheetBottomInset(initialDetentIndex, height));
      return;
    }
    // 換 allowed detents 本身不保證落點（UIKit 會留在同索引的 detent）：選到地點時確實升到 half、
    // 開始導航時確實收成行程列（Apple 地圖的連貫轉場）。其他情況（例：從地點返回搜尋結果）保留使用者的高度。
    if (initialDetentIndex > 0 || isNavigating) void sheetController.select(initialDetentIndex);
  }, [initialDetentIndex, isNavigating, height, setSheetInset]);
  usePreferencesEffects();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      {appConfigResult.ok ? <AppStack detents={detents} initialDetentIndex={initialDetentIndex} height={height} setSheetInset={setSheetInset} /> : (
        <ConfigErrorScreen errors={appConfigResult.errors} />
      )}
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}

interface AppStackProps {
  detents: number[];
  initialDetentIndex: number;
  height: number;
  setSheetInset: (inset: number) => void;
}

/** 設定有效才掛載：Phase 3 的啟動 hook（續期、同步、推播、SOS 復原）都會打 API，需要 `getAppConfig()`。 */
function AppStack({ detents, initialDetentIndex, height, setSheetInset }: AppStackProps) {
  useAuthBootstrap();
  useSettingsSync();
  useNotificationsBootstrap();
  useSosBootstrap();
  useAiBootstrap();
  const { t } = useAppTranslation();
  const sosInProgress = useSosStore(selectSosInProgress);
  return (
    <Stack screenOptions={{ headerShown: false, headerBackButtonDisplayMode: 'minimal' }}>
      <Stack.Screen name="index" />
      <Stack.Screen
        name="(sheet)"
        options={{
          presentation: 'formSheet',
          sheetAllowedDetents: detents,
          sheetInitialDetentIndex: initialDetentIndex,
          sheetLargestUndimmedDetentIndex: SHEET_UNDIMMED_DETENT_INDEX,
          sheetGrabberVisible: true,
          gestureEnabled: false,
        }}
        listeners={{
          sheetDetentChange: (event) => {
            setSheetInset(sheetBottomInset(event.data.index, height));
            useMapUiStore.getState().setSheetDetentIndex(event.data.index);
          },
          focus: () => setSheetInset(sheetBottomInset(initialDetentIndex, height)),
        }}
      />
      <Stack.Screen
        name="onboarding"
        options={{ presentation: 'fullScreenModal', headerShown: false, gestureEnabled: false }}
      />
      <Stack.Screen
        name="auth"
        options={{ presentation: 'modal', headerShown: true, headerLeft: () => <HeaderCloseButton /> }}
      />
      <Stack.Screen name="settings" options={{ presentation: 'modal', headerShown: false }} />
      {/* 倒數與求救中不可滑動關閉（防誤觸，SDD §6.8）；畫面內有「關閉畫面（SOS 持續）」按鈕 */}
      <Stack.Screen name="sos" options={{ presentation: 'fullScreenModal', headerShown: false, gestureEnabled: !sosInProgress }} />
      <Stack.Screen name="hazard-report" options={{ presentation: 'modal', headerShown: true, title: t('hazardReport') }} />
      <Stack.Screen name="review" options={{ presentation: 'modal', headerShown: true }} />
      {/* 聊天只有一個：已開著時再開（深層連結 `chat?q=`）沿用同一個 modal，只換預填問題 */}
      <Stack.Screen name="chat" dangerouslySingular={() => 'chat'} options={{ presentation: 'modal', headerShown: true }} />
      <Stack.Screen name="spikes" />
    </Stack>
  );
}
