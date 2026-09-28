import { Host, ProgressView, Text, VStack } from '@expo/ui/swift-ui';
import { accessibilityLabel } from '@expo/ui/swift-ui/modifiers';

import type { LoadingStateProps } from './LoadingState.types';

const DEFAULT_LABEL = '載入中';

export default function LoadingState({ label = DEFAULT_LABEL }: LoadingStateProps) {
  return (
    <Host style={{ flex: 1 }} modifiers={[accessibilityLabel(label)]}>
      <VStack spacing={12} alignment="center">
        <ProgressView />
        <Text>{label}</Text>
      </VStack>
    </Host>
  );
}
