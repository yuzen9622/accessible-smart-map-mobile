import { Text } from '@expo/ui/swift-ui';
import { disabled } from '@expo/ui/swift-ui/modifiers';
import { useAppTranslation } from '@/shared/i18n';
import Host from '@/shared/ui/typography/PreferenceHost.ios';
import { Form, Section, Button } from '@/shared/ui/form/PreferenceForm.ios';
import type { BlockedUsersPanelProps } from './BlockedUsersPanel.types';
export default function BlockedUsersPanel({ model }: BlockedUsersPanelProps) {
  const { t, i18n } = useAppTranslation();
  return <Host style={{ flex: 1 }}><Form>
    <Section footer={<Text>{t('contentBlockExplanation')}</Text>}>
      {model.loading ? <Text>{t('loading')}</Text> : null}
      {model.error ? <><Text>{t('contentActionFailed')}</Text><Button label={t('retry')} onPress={model.retry} /></> : null}
      {!model.loading && !model.error && model.items.length === 0 ? <Text>{t('contentBlocksEmpty')}</Text> : null}
    </Section>
    {model.items.map(item => <Section key={item.blockId} title={t(item.label === 'review' ? 'contentBlocked_review' : item.label === 'hazard_report' ? 'contentBlocked_hazard_report' : 'contentBlockedUser')}>
      <Text>{`${t('contentBlockedAt')} ${new Date(item.createdAt).toLocaleDateString(i18n.language)}`}</Text>
      <Button label={t(model.pending === item.blockId ? 'loading' : 'contentUnblock')} modifiers={[disabled(model.pending !== null)]} onPress={() => model.unblock(item.blockId)} />
    </Section>)}
  </Form></Host>;
}
