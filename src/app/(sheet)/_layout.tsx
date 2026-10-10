import { Stack } from 'expo-router';
import { useFontScale } from '@/shared/preferences';

export const unstable_settings = { initialRouteName: 'explore' };

/** sheet 內的面板堆疊：面板之間 push／back，返回鍵只顯示箭頭（不帶上一頁標題）。 */
export default function SheetLayout() {
  const fontScale = useFontScale();
  return <Stack screenOptions={{ headerTransparent: true, headerShadowVisible: false, headerBackButtonDisplayMode: 'minimal', headerTitleStyle: { fontSize: 17 * fontScale } }} />;
}
