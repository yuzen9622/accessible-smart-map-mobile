import { useAppTranslation } from '@/shared/i18n';
import { FormButton, FormRow, FormScreen, FormSection, FormText } from '@/shared/ui';
import type { BlockedUsersPanelProps } from './BlockedUsersPanel.types';
export default function BlockedUsersPanel({ model }: BlockedUsersPanelProps) {
  const { t, i18n } = useAppTranslation();
  return <FormScreen><FormSection footer={t('contentBlockExplanation')}>
    {model.loading ? <FormText>{t('loading')}</FormText> : null}
    {model.error ? <><FormText tone="error">{t('contentActionFailed')}</FormText><FormButton label={t('retry')} onPress={model.retry} /></> : null}
    {!model.loading && !model.error && model.items.length === 0 ? <FormText>{t('contentBlocksEmpty')}</FormText> : null}
    {model.items.map(item => <FormSection key={item.blockId} title={t(item.label === 'review' ? 'contentBlocked_review' : item.label === 'hazard_report' ? 'contentBlocked_hazard_report' : 'contentBlockedUser')}>
      <FormRow label={t('contentBlockedAt')} value={new Date(item.createdAt).toLocaleDateString(i18n.language)} />
      <FormButton label={t('contentUnblock')} variant="secondary" disabled={model.pending !== null} loading={model.pending === item.blockId} onPress={() => model.unblock(item.blockId)} />
    </FormSection>)}
  </FormSection></FormScreen>;
}
