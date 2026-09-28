import {
  Button,
  Form,
  HStack,
  Host,
  Label,
  LabeledContent,
  ProgressView,
  Section,
  ShareLink,
  Spacer,
  Text,
  VStack,
} from '@expo/ui/swift-ui';
import { accessibilityLabel, buttonStyle, font, foregroundStyle } from '@expo/ui/swift-ui/modifiers';

import type { PlaceDetailViewProps } from './PlaceDetailView.types';

export default function PlaceDetailView({ model, loading }: PlaceDetailViewProps) {
  if (loading) {
    return (
      <Host style={{ flex: 1 }}>
        <Form>
          <Section>
            <ProgressView />
          </Section>
        </Form>
      </Host>
    );
  }

  return (
    <Host style={{ flex: 1 }}>
      <Form>
        <Section footer={model.subtitle ? <Text>{model.subtitle}</Text> : undefined}>
          <Text modifiers={[font({ textStyle: 'title2', weight: 'bold' })]}>{model.title}</Text>
        </Section>

        <Section>
          <Button
            label={model.planRouteLabel}
            systemImage="location.north.line.fill"
            onPress={model.onPlanRoute}
            modifiers={[buttonStyle('borderedProminent')]}
          />
          <Button
            label={model.saveLabel}
            systemImage={model.saved ? 'star.fill' : 'star'}
            onPress={model.onToggleSave}
            modifiers={[buttonStyle('bordered'), accessibilityLabel(model.saveLabel)]}
          />
          <ShareLink item={model.shareUrl} subject={model.title}>
            <Label title={model.shareLabel} systemImage="square.and.arrow.up" />
          </ShareLink>
          <Button
            label={model.copyLabel}
            systemImage={model.copied ? 'checkmark' : 'doc.on.doc'}
            onPress={model.onCopy}
            modifiers={[buttonStyle('bordered')]}
          />
        </Section>

        {model.categories ? (
          <Section>
            {model.categories.map((cat) => (
              <Button key={cat.value} onPress={cat.onSelect} modifiers={[buttonStyle('plain')]}>
                <HStack>
                  <Text>{cat.label}</Text>
                  <Spacer />
                  {cat.isSelected ? (
                    <Text modifiers={[foregroundStyle({ type: 'hierarchical', style: 'primary' })]}>{'✓'}</Text>
                  ) : null}
                </HStack>
              </Button>
            ))}
          </Section>
        ) : null}

        {model.addressRows.length > 0 ? (
          <Section title={model.addressTitle}>
            {model.addressRows.map((row) => (
              <LabeledContent key={row.label} label={row.label}>
                <Text>{row.value}</Text>
              </LabeledContent>
            ))}
          </Section>
        ) : null}

        {model.checklist.length > 0 ? (
          <Section title={model.checklistTitle}>
            {model.checklist.map((item) => (
              <LabeledContent key={item.key} label={item.label}>
                <Text
                  modifiers={[
                    foregroundStyle({ type: 'hierarchical', style: item.tone === 'yes' ? 'primary' : 'secondary' }),
                  ]}>
                  {item.statusLabel}
                </Text>
              </LabeledContent>
            ))}
          </Section>
        ) : null}

        {model.links.length > 0 ? (
          <Section>
            {model.links.map((link) => (
              <Button key={link.label} label={link.label} onPress={link.onPress} modifiers={[buttonStyle('plain')]} />
            ))}
          </Section>
        ) : null}

        {model.reviews ? (
          <Section title={model.reviews.titleLabel}>
            {model.reviews.aiSummary ? (
              <VStack alignment="leading" spacing={4}>
                <Text modifiers={[font({ textStyle: 'footnote', weight: 'semibold' })]}>{model.reviews.aiSummaryLabel}</Text>
                <Text>{model.reviews.aiSummary}</Text>
              </VStack>
            ) : null}
            {model.reviews.loading ? <ProgressView /> : null}
            {!model.reviews.loading && model.reviews.items.length === 0 ? <Text>{model.reviews.emptyLabel}</Text> : null}
            {model.reviews.items.map((review) => (
              <VStack key={review.key} alignment="leading" spacing={2}>
                <Text>{review.starsLabel}</Text>
                {review.comment ? (
                  <Text modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>{review.comment}</Text>
                ) : null}
              </VStack>
            ))}
            {model.reviews.hasMore ? (
              <Button label={model.reviews.loadMoreLabel} onPress={model.reviews.onLoadMore} modifiers={[buttonStyle('plain')]} />
            ) : null}
          </Section>
        ) : null}
      </Form>
    </Host>
  );
}
