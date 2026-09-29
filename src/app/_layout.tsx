import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useColorScheme, useWindowDimensions } from 'react-native';

import {
  SHEET_DETENTS,
  SHEET_UNDIMMED_DETENT_INDEX,
  sheetBottomInset,
  useMapUiStore,
} from '@/features/map';
import { useNavStore } from '@/features/navigation';
import { ConfigErrorScreen, appConfigResult } from '@/shared/config';
import { useDeviceLanguageSync } from '@/shared/i18n';
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
  // 換 allowed detents 時 sheet 會重新落在第一個 detent，但不會發 sheetDetentChange：同步地圖 inset。
  useEffect(() => {
    setSheetInset(sheetBottomInset(0, height));
  }, [isNavigating, height, setSheetInset]);
  useDeviceLanguageSync();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      {appConfigResult.ok ? (
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen
            name="(sheet)"
            options={{
              presentation: 'formSheet',
              sheetAllowedDetents: isNavigating ? SHEET_DETENTS.slice(0, SHEET_UNDIMMED_DETENT_INDEX + 1) : [...SHEET_DETENTS],
              sheetInitialDetentIndex: 0,
              sheetLargestUndimmedDetentIndex: SHEET_UNDIMMED_DETENT_INDEX,
              sheetGrabberVisible: true,
              gestureEnabled: false,
            }}
            listeners={{
              sheetDetentChange: (event) => {
                setSheetInset(sheetBottomInset(event.data.index, height));
              },
              focus: () => setSheetInset(sheetBottomInset(0, height)),
            }}
          />
          <Stack.Screen
            name="onboarding"
            options={{ presentation: 'fullScreenModal', headerShown: false, gestureEnabled: false }}
          />
          <Stack.Screen name="spikes" />
        </Stack>
      ) : (
        <ConfigErrorScreen errors={appConfigResult.errors} />
      )}
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
