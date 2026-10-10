import Host from '@/shared/ui/typography/PreferenceHost.ios';
import { ContentUnavailableView } from '@expo/ui/swift-ui';

import type { EmptyStateProps } from './EmptyState.types';

export default function EmptyState({ title, description, systemImage = 'tray' }: EmptyStateProps) {
  return (
    <Host style={{ flex: 1 }}>
      <ContentUnavailableView title={title} systemImage={systemImage} description={description} />
    </Host>
  );
}
