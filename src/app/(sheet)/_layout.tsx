import { Stack } from 'expo-router';

export const unstable_settings = { initialRouteName: 'explore' };

/** sheet 內的面板堆疊：面板之間 push／back，返回鍵與標題由原生導覽列提供。 */
export default function SheetLayout() {
  return <Stack screenOptions={{ headerTransparent: true, headerShadowVisible: false }} />;
}
