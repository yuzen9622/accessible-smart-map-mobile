import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme, useWindowDimensions } from 'react-native';

import {
  SHEET_DETENTS,
  SHEET_UNDIMMED_DETENT_INDEX,
  sheetBottomInset,
  useMapUiStore,
} from '@/features/map';
import { ConfigErrorScreen, appConfigResult } from '@/shared/config';
import { useDeviceLanguageSync } from '@/shared/i18n';

// 深層連結（例如 accessiblesmartmap://place/123）直接開 sheet 路由時，底下仍要有地圖。
export const unstable_settings = { initialRouteName: 'index' };

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const { height } = useWindowDimensions();
  const setSheetInset = useMapUiStore((state) => state.setSheetInset);
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
              sheetAllowedDetents: [...SHEET_DETENTS],
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
