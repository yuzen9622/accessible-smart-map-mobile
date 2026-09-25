import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';

import { ConfigErrorScreen, appConfigResult } from '@/shared/config';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      {appConfigResult.ok ? (
        <Stack screenOptions={{ headerShown: false }} />
      ) : (
        <ConfigErrorScreen errors={appConfigResult.errors} />
      )}
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
