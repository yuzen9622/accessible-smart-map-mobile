import { FormRow, FormScreen, FormSection } from '@/shared/ui';

import type { DataPanelProps } from './DataPanel.types';

export default function DataPanel({ model }: DataPanelProps) {
  return (
    <FormScreen>
      {model.rows.map((row) => (
        <FormSection key={row.key} title={row.title} footer={row.description}>
          <FormRow label={row.title} value={row.status} />
          <FormRow label={row.actionLabel} destructive disabled={row.disabled} onPress={row.onPress} />
        </FormSection>
      ))}
    </FormScreen>
  );
}
