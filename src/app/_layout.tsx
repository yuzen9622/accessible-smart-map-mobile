import { DarkTheme, DefaultTheme, Stack, ThemeProvider, usePathname, type ErrorBoundaryProps } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { BackHandler, Platform, View, useColorScheme, useWindowDimensions } from 'react-native';

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
import { logger } from '@/shared/logger';
import { useFontScale, usePreferencesEffects } from '@/shared/preferences';
import { ErrorState, HeaderCloseButton } from '@/shared/ui';
// 背景定位任務必須在 JS 頂層定義（App 從背景被喚醒時要找得到）
import '@/shared/location/backgroundLocation';

// 深層連結（例如 accessiblesmartmap://place/123）直接開 sheet 路由時，底下仍要有地圖。
export const unstable_settings = { initialRouteName: 'index' };

/** 畫面渲染錯誤時取代白屏：提示並可重試（Expo Router 會把子樹的錯誤交到最近的 ErrorBoundary）。 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const { t } = useAppTranslation();
  useEffect(() => {
    logger.error('[ErrorBoundary]', error);
  }, [error]);
  return (
    <View style={{ flex: 1, justifyContent: 'center' }}>
      <ErrorState
        title={t('nativeUnexpectedErrorTitle')}
        description={t('nativeUnexpectedErrorBody')}
        retry={{ label: t('retry'), onPress: () => void retry() }}
      />
    </View>
  );
}

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
  const hasFocusedSheet = useRef(false);
  const fontScale = useFontScale();
  useAuthBootstrap();
  useSettingsSync();
  useNotificationsBootstrap();
  useSosBootstrap();
  useAiBootstrap();
  const { t } = useAppTranslation();
  const sosInProgress = useSosStore(selectSosInProgress);
  return (
    <Stack screenOptions={{ headerShown: false, headerBackButtonDisplayMode: 'minimal', headerTitleStyle: { fontSize: 17 * fontScale } }}>
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
          // 首頁 sheet 常駐：任何「退到底」的返回（連點關閉、非同步完成後的返回、sheet 最底層按返回）都不能把它移除，
          // 否則 sheet 與其底層的探索頁一起消失，之後的面板會變成新 sheet 的第一頁、回不到首頁。
          // Android 在首頁按返回鍵照系統慣例離開 App。
          beforeRemove: (event) => {
            event.preventDefault();
            if (Platform.OS === 'android' && event.data.action.type === 'GO_BACK') BackHandler.exitApp();
          },
          sheetDetentChange: (event) => {
            setSheetInset(sheetBottomInset(event.data.index, height));
            useMapUiStore.getState().setSheetDetentIndex(event.data.index);
          },
          focus: () => {
            const state = useMapUiStore.getState();
            // 只有首次開啟使用初始高度；關閉 chat/settings 後 UIKit 保留原高度，
            // 不會再發 detent 事件，不能把 inset 重設成 peek，否則首頁內容會被隱藏。
            const index = hasFocusedSheet.current ? state.sheetDetentIndex : initialDetentIndex;
            hasFocusedSheet.current = true;
            state.setSheetDetentIndex(index);
            setSheetInset(sheetBottomInset(index, height));
          },
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
    </Stack>
  );
}
