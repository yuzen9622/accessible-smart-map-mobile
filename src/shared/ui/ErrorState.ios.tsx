import Host from '@/shared/ui/typography/PreferenceHost.ios';
import { Button as SwiftUIButton, ContentUnavailableView, VStack } from '@expo/ui/swift-ui';
import { accessibilityLabel, frame } from '@expo/ui/swift-ui/modifiers';

import type { ErrorStateProps } from './ErrorState.types';

export default function ErrorState({
  title,
  description,
  systemImage = 'exclamationmark.triangle',
  retry,
}: ErrorStateProps) {
  return (
    <Host style={{ flex: 1 }} matchContents={{ vertical: !retry }}>
      <VStack spacing={16} alignment="center">
        <ContentUnavailableView title={title} systemImage={systemImage} description={description} />
        {retry ? (
          <SwiftUIButton
            label={retry.label}
            onPress={retry.onPress}
            modifiers={[frame({ minHeight: 44 }), accessibilityLabel(retry.label)]}
          />
        ) : null}
      </VStack>
    </Host>
  );
}
