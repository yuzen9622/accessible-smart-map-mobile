import { ActivityIndicator } from 'react-native';

import { useAppTranslation } from '@/shared/i18n';
import { FormButton, FormRow, FormScreen, FormSection, FormText } from '@/shared/ui';

import type { MyReportsPanelProps } from './MyReportsPanel.types';

export default function MyReportsPanel({ model }: MyReportsPanelProps) {
  const { t } = useAppTranslation();
  return (
    <FormScreen>
      <FormSection title={t('nativeMyReports')}>
        {model.empty ? <FormText tone="secondary">{t('nativeMyReportsEmpty')}</FormText> : null}
        {model.rows.map((row) => (
          <FormRow key={row.id} label={row.title} value={row.subtitle} onPress={row.onPress} />
        ))}
        {model.loading ? <ActivityIndicator /> : null}
        {model.error ? (
          <>
            <FormText tone="error">{t('nativeNetworkError')}</FormText>
            <FormButton label={t('retry')} variant="secondary" onPress={model.retry} />
          </>
        ) : null}
        {model.hasMore && !model.loading ? <FormButton label={t('reviewLoadMore')} variant="secondary" onPress={model.loadMore} /> : null}
      </FormSection>
    </FormScreen>
  );
}
