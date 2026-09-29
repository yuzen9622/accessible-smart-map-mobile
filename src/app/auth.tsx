import { Stack, useLocalSearchParams } from 'expo-router';

import { AuthScreen, type AuthMode } from '@/features/auth';
import { useAppTranslation } from '@/shared/i18n';

function parseMode(value: unknown): AuthMode {
  return value === 'register' || value === 'forgot' ? value : 'login';
}

/** 登入／註冊／忘記密碼（root modal；任何需要登入的入口都 push 這裡）。 */
export default function AuthRoute() {
  const { t } = useAppTranslation();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  return (
    <>
      <Stack.Screen options={{ title: t('loginRegisterCta') }} />
      <AuthScreen initialMode={parseMode(mode)} />
    </>
  );
}
