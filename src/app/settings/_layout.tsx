import { Stack } from 'expo-router';

import { useAppTranslation } from '@/shared/i18n';
import { HeaderCloseButton } from '@/shared/ui';

export const unstable_settings = { initialRouteName: 'index' };

/** 設定（root modal）內的 stack：子頁 push／back，原生導覽列提供返回鍵與標題。 */
export default function SettingsLayout() {
  const { t } = useAppTranslation();
  return (
    <Stack screenOptions={{ headerBackButtonDisplayMode: 'minimal' }}>
      <Stack.Screen name="index" options={{ title: t('settingTitle'), headerLeft: () => <HeaderCloseButton /> }} />
      <Stack.Screen name="security" options={{ title: t('nativeSettingsAccountSecurity') }} />
      <Stack.Screen name="line" options={{ title: t('nativeLineTitle') }} />
      <Stack.Screen name="contacts" options={{ title: t('sosContactsManageTitle') }} />
      <Stack.Screen name="needs" options={{ title: t('nativeSettingsNeeds') }} />
      <Stack.Screen name="memory" options={{ title: t('aiMemoryTitle') }} />
      <Stack.Screen name="data" options={{ title: t('settingsDataTitle') }} />
      <Stack.Screen name="reports" options={{ title: t('nativeMyReports') }} />
      <Stack.Screen name="report/[id]" options={{ title: t('reportDetailEyebrow') }} />
    </Stack>
  );
}
