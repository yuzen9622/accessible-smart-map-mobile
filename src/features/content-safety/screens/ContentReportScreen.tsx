import { router, useLocalSearchParams } from 'expo-router';
import { selectIsLoggedIn, useAuthStore } from '@/features/auth';
import { useAppTranslation } from '@/shared/i18n';
import { FormButton, FormScreen, FormText } from '@/shared/ui';
import ContentReportPanel from '../components/ContentReportPanel';
import type { ContentTarget } from '../domain/types';
import { useContentReport } from '../hooks/useContentReport';
import { useContentSafetyStore } from '../store/contentSafetyStore';

function ReportForm({ target }: { target: ContentTarget }) { return <ContentReportPanel model={useContentReport(target)} />; }
export default function ContentReportScreen() {
  const { t } = useAppTranslation();
  const loggedIn = useAuthStore(selectIsLoggedIn);
  const epoch = useContentSafetyStore(state => state.ownerEpoch);
  const { targetType, targetId } = useLocalSearchParams<{ targetType?: string; targetId?: string }>();
  if (!loggedIn) return <FormScreen><FormText>{t('contentLoginRequired')}</FormText><FormButton label={t('loginRegisterCta')} onPress={() => router.navigate('/auth')} /></FormScreen>;
  if ((targetType !== 'review' && targetType !== 'hazard_report') || !targetId || !/^[a-f0-9]{24}$/i.test(targetId)) return <FormScreen><FormText>{t('contentInvalidTarget')}</FormText></FormScreen>;
  return <ReportForm key={`${epoch}:${targetType}:${targetId}`} target={{ targetType, targetId }} />;
}
