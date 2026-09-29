import { FormScreen, FormSection, FormSwitch, FormText } from '@/shared/ui';

import type { NeedsPanelProps } from './NeedsPanel.types';

export default function NeedsPanel({ model }: NeedsPanelProps) {
  return (
    <FormScreen>
      <FormSection title={model.title} footer={model.hint}>
        {model.options.map((option) => (
          <FormSwitch key={option.id} label={`${option.label} — ${option.description}`} value={option.selected} onValueChange={option.onToggle} />
        ))}
      </FormSection>
      <FormText tone="secondary">{model.derivedModeText}</FormText>
    </FormScreen>
  );
}
