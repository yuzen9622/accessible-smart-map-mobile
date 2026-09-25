import { ContentUnavailableView, Host } from '@expo/ui/swift-ui';

import { CONFIG_ERROR_TITLE, type ConfigErrorScreenProps } from './ConfigErrorScreen.types';

export default function ConfigErrorScreen({ errors }: ConfigErrorScreenProps) {
  return (
    <Host style={{ flex: 1 }}>
      <ContentUnavailableView
        title={CONFIG_ERROR_TITLE}
        systemImage="exclamationmark.triangle"
        description={errors.join('\n')}
      />
    </Host>
  );
}
