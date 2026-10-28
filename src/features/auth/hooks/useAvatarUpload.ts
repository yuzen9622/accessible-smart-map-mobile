import { useState } from 'react';

import { logger } from '@/shared/logger';

import { uploadAvatar } from '../api/authApi';
import { pickAvatarPhoto } from '../controller/avatarPicker';
import { useAuthStore } from '../store/authStore';

export type AvatarUploadOutcome = 'ok' | 'cancelled' | 'failed';

/**
 * 個人設定／帳號頁的「更換頭像」：選圖→本機套用（立刻看到新頭像）→上傳→成功後把本機 `uri`
 * 換成伺服器網址；失敗時還原成原本的頭像並回傳 `'failed'`，由呼叫端提示使用者。
 */
export function useAvatarUpload() {
  const [uploading, setUploading] = useState(false);

  const pickAndUpload = async (): Promise<AvatarUploadOutcome> => {
    const picked = await pickAvatarPhoto();
    if (picked.kind !== 'ok') return 'cancelled';
    const user = useAuthStore.getState().user;
    if (!user) return 'cancelled';

    const previous = user.avatar;
    useAuthStore.getState().setUser({ ...user, avatar: picked.photo.uri });
    setUploading(true);
    try {
      const { avatarUrl } = await uploadAvatar({ uri: picked.photo.uri });
      const latest = useAuthStore.getState().user;
      if (latest) useAuthStore.getState().setUser({ ...latest, avatar: avatarUrl });
      return 'ok';
    } catch (error) {
      logger.warn('[auth] avatar upload failed', error);
      const latest = useAuthStore.getState().user;
      if (latest?.avatar === picked.photo.uri) useAuthStore.getState().setUser({ ...latest, avatar: previous });
      return 'failed';
    } finally {
      setUploading(false);
    }
  };

  return { uploading, pickAndUpload };
}
