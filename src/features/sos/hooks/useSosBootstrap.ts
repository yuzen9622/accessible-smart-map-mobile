import { router } from 'expo-router';
import { useEffect } from 'react';

import { onLogout, selectIsLoggedIn, useAuthStore } from '@/features/auth';

import { recoverActiveSos, resetSosOnLogout } from '../controller/sosController';

/** 在根 layout 呼叫一次：登入且 session 讀回後，嘗試復原重啟前進行中的 SOS（只試一次），並在登出時停止本機追蹤。 */
export function useSosBootstrap(): void {
  const loggedIn = useAuthStore(selectIsLoggedIn);
  const restored = useAuthStore((s) => s.restored);

  useEffect(() => {
    if (!restored || !loggedIn) return;
    const run = async () => {
      try {
        if (await recoverActiveSos()) router.navigate('/sos');
      } catch (error) {
        console.warn('[sos] recovery failed', error);
      }
    };
    void run();
  }, [restored, loggedIn]);

  useEffect(() => onLogout(() => resetSosOnLogout()), []);
}
