import { Button, Form, Host, ProgressView, Section, Text, VStack } from '@expo/ui/swift-ui';
import { font, foregroundStyle } from '@expo/ui/swift-ui/modifiers';

import { useAppTranslation } from '@/shared/i18n';

import type { MyReportsPanelProps } from './MyReportsPanel.types';

const secondary = [font({ textStyle: 'footnote' }), foregroundStyle({ type: 'hierarchical', style: 'secondary' })];

export default function MyReportsPanel({ model }: MyReportsPanelProps) {
  const { t } = useAppTranslation();
  return (
    <Host style={{ flex: 1 }}>
      <Form>
        <Section title={t('nativeMyReports')}>
          {model.empty ? <Text modifiers={secondary}>{t('nativeMyReportsEmpty')}</Text> : null}
          {model.rows.map((row) => (
            <Button key={row.id} onPress={row.onPress}>
              <VStack alignment="leading">
                <Text>{row.title}</Text>
                <Text modifiers={secondary}>{row.subtitle}</Text>
                {row.description ? <Text modifiers={secondary}>{row.description}</Text> : null}
              </VStack>
            </Button>
          ))}
          {model.loading ? <ProgressView /> : null}
          {model.error ? <Button label={t('retry')} onPress={model.retry} /> : null}
          {model.hasMore && !model.loading ? <Button label={t('reviewLoadMore')} onPress={model.loadMore} /> : null}
        </Section>
      </Form>
    </Host>
  );
}
