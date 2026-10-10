import { router } from 'expo-router';
import { selectIsLoggedIn, useAuthStore } from '@/features/auth';
import { useAppTranslation } from '@/shared/i18n';
import { FormButton, FormScreen, FormText } from '@/shared/ui';
import BlockedUsersPanel from '../components/BlockedUsersPanel';
import { useBlockedUsers } from '../hooks/useBlockedUsers';
import { useContentSafetyStore } from '../store/contentSafetyStore';
function List() { return <BlockedUsersPanel model={useBlockedUsers()} />; }
export default function BlockedUsersScreen() {
  const { t } = useAppTranslation();
  const loggedIn = useAuthStore(selectIsLoggedIn);
  const epoch = useContentSafetyStore(state => state.ownerEpoch);
  if (!loggedIn) return <FormScreen><FormText>{t('contentLoginRequired')}</FormText><FormButton label={t('loginRegisterCta')} onPress={() => router.navigate('/auth')} /></FormScreen>;
  return <List key={epoch} />;
}
