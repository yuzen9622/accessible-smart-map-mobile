import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import { selectIsLoggedIn, useAuthStore } from '@/features/auth';
import { useAppTranslation } from '@/shared/i18n';
import { useThemeColors } from '@/shared/theme';
import { MoreActionsButton } from '@/shared/ui';
import { blockContentAuthor } from '../api/contentSafetyApi';
import type { ContentTarget } from '../domain/types';
import { captureContentOwner, invalidateContentSafety } from '../store/contentSafetyStore';

export default function ContentActions({ targetType, targetId, canBlock = true }: ContentTarget & { canBlock?: boolean }) {
  const { t } = useAppTranslation();
  const colors = useThemeColors();
  const busy = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const requireLogin = () => {
    if (selectIsLoggedIn(useAuthStore.getState())) return true;
    router.navigate('/auth');
    return false;
  };
  const block = () => {
    if (!requireLogin() || busy.current) return;
    const current = captureContentOwner();
    Alert.alert(t('contentBlock'), t('contentBlockExplanation'), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('contentBlock'), style: 'destructive', onPress: () => {
        if (!current() || busy.current || !mounted.current) return;
        busy.current = true;
        const run = async () => {
          try {
            await blockContentAuthor({ targetType, targetId });
            if (current()) {
              invalidateContentSafety();
              if (mounted.current) Alert.alert(t('contentBlocked'));
            }
          } catch {
            if (current() && mounted.current) Alert.alert(t('contentActionFailed'));
          } finally {
            busy.current = false;
          }
        };
        void run();
      } },
    ]);
  };
  return <MoreActionsButton label={t('contentActions')} cancelLabel={t('cancel')} backgroundColor={colors.backgroundElement} color={colors.text}
    actions={[
      { label: t('contentReport'), onPress: () => { if (requireLogin()) router.navigate({ pathname: '/content-report', params: { targetType, targetId } }); } },
      ...(canBlock ? [{ label: t('contentBlock'), onPress: block }] : []),
    ]} />;
}
