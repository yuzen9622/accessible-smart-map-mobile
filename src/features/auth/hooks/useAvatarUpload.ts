import { useState } from 'react';

import { logger } from '@/shared/logger';

import { uploadAvatar } from '../api/authApi';
import { pickAvatarPhoto } from '../controller/avatarPicker';
import { useAuthStore } from '../store/authStore';

/**
 * 個人設定／帳號頁的「更換頭像」：選圖→本機套用（立刻看到新頭像）→背景上傳→成功後把
 * 本機 `uri` 換成伺服器網址。`uploadAvatar` 目前後端端點還沒接（見 `api/authApi.ts` 的 TODO），
 * 失敗時吞掉錯誤、保留本機預覽，不影響「選好馬上看到」的體驗；之後端點接上後這裡不用改。
 */
export function useAvatarUpload() {
  const [uploading, setUploading] = useState(false);

  const pickAndUpload = async (): Promise<'ok' | 'cancelled'> => {
    const picked = await pickAvatarPhoto();
    if (picked.kind !== 'ok') return 'cancelled';
    const user = useAuthStore.getState().user;
    if (!user) return 'cancelled';

    useAuthStore.getState().setUser({ ...user, avatar: picked.photo.uri });
    setUploading(true);
    try {
      const { avatarUrl } = await uploadAvatar({ uri: picked.photo.uri });
      const latest = useAuthStore.getState().user;
      if (latest) useAuthStore.getState().setUser({ ...latest, avatar: avatarUrl });
    } catch (error) {
      logger.warn('[auth] avatar upload failed', error);
    } finally {
      setUploading(false);
    }
    return 'ok';
  };

  return { uploading, pickAndUpload };
}
