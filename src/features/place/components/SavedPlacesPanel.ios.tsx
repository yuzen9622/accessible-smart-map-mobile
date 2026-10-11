import { useState } from 'react';
import Host from '@/shared/ui/typography/PreferenceHost.ios';
import { HStack, Spacer, SwipeActions, Text, VStack } from '@expo/ui/swift-ui';
import { Button, Form, Section, useSecondaryForeground } from '@/shared/ui/form/PreferenceForm.ios';
import { accessibilityLabel, buttonStyle, foregroundStyle } from '@expo/ui/swift-ui/modifiers';

import { useAppTranslation } from '@/shared/i18n';
import { Alert } from 'react-native';

import CategoryNameModal from './CategoryNameModal';
import type { SavedPlacesPanelProps } from './SavedPlacesPanel.types';

type ModalState = { mode: 'create' } | { mode: 'rename'; target: string } | null;

export default function SavedPlacesPanel({ model }: SavedPlacesPanelProps) {
  const { t } = useAppTranslation();
  const secondaryForeground = useSecondaryForeground();
  const [modalState, setModalState] = useState<ModalState>(null);
  if (model.status === 'empty') {
    return (
      <Host style={{ flex: 1 }}>
        <Form>
          <Section>
            <Text>{model.emptyTitle}</Text>
            <Text modifiers={[secondaryForeground]}>{model.emptyDescription}</Text>
          </Section>
        </Form>
      </Host>
    );
  }

  const { categoryManagement } = model;

  const confirmDeleteCategory = (name: string) => {
    Alert.alert(categoryManagement.deleteLabel, t('nativeSavedCategoryDeleteConfirm', { name }), [
      { text: t('cancel'), style: 'cancel' },
      { text: categoryManagement.deleteLabel, style: 'destructive', onPress: () => categoryManagement.onDelete(name) },
    ]);
  };

  return (
    <>
    <Host style={{ flex: 1 }}>
      <Form>
        <Section header={<Text>{model.countLabel}</Text>}>
          {model.filters.map((filter) =>
            filter.isCustom ? (
              // 自訂分類才能編輯：長按走系統 Alert 選單（重新命名／刪除），內建分類沒有這個手勢。
              <SwipeActions key={filter.value}>
                <Button onPress={filter.onSelect} modifiers={[buttonStyle('plain')]}>
                  <HStack>
                    <Text>{filter.label}</Text>
                    <Spacer />
                    {filter.isSelected ? (
                      <Text modifiers={[foregroundStyle({ type: 'hierarchical', style: 'primary' })]}>{'✓'}</Text>
                    ) : null}
                  </HStack>
                </Button>
                <SwipeActions.Actions edge="trailing">
                  <Button label={categoryManagement.renameLabel} onPress={() => setModalState({ mode: 'rename', target: filter.value })} />
                  <Button role="destructive" label={categoryManagement.deleteLabel} onPress={() => confirmDeleteCategory(filter.value)} />
                </SwipeActions.Actions>
              </SwipeActions>
            ) : (
              <Button key={filter.value} onPress={filter.onSelect} modifiers={[buttonStyle('plain')]}>
                <HStack>
                  <Text>{filter.label}</Text>
                  <Spacer />
                  {filter.isSelected ? (
                    <Text modifiers={[foregroundStyle({ type: 'hierarchical', style: 'primary' })]}>{'✓'}</Text>
                  ) : null}
                </HStack>
              </Button>
            ),
          )}
          <Button onPress={() => setModalState({ mode: 'create' })} modifiers={[buttonStyle('plain')]}>
            <HStack>
              <Text modifiers={[secondaryForeground]}>{categoryManagement.addLabel}</Text>
            </HStack>
          </Button>
        </Section>

        <Section>
          {model.rows.map((row) => (
            // SwipeActions 左滑刪除：本次時間盒內未在模擬器上實測，行為以 SwiftUI 官方語意為準（見 port-ledger）。
            <SwipeActions key={row.key}>
              <Button
                onPress={row.onPress}
                modifiers={[
                  buttonStyle('plain'),
                  accessibilityLabel(row.categoryLabel ? `${row.title}，${row.categoryLabel}` : row.title),
                ]}>
                <VStack alignment="leading" spacing={2}>
                  <Text>{row.title}</Text>
                  {row.categoryLabel ? (
                    <Text modifiers={[secondaryForeground]}>{row.categoryLabel}</Text>
                  ) : null}
                </VStack>
              </Button>
              <SwipeActions.Actions edge="trailing">
                <Button
                  role="destructive"
                  label={model.unsaveLabel}
                  onPress={row.onRemove}
                  modifiers={[accessibilityLabel(row.removeAccessibilityLabel)]}
                />
              </SwipeActions.Actions>
            </SwipeActions>
          ))}
        </Section>
      </Form>
    </Host>
    <CategoryNameModal
      visible={modalState !== null}
      title={modalState?.mode === 'rename' ? categoryManagement.renameCategoryTitle : categoryManagement.newCategoryTitle}
      initialValue={modalState?.mode === 'rename' ? modalState.target : undefined}
      onCancel={() => setModalState(null)}
      onSubmit={(name) => {
        if (modalState?.mode === 'rename') categoryManagement.onRename(modalState.target, name);
        else categoryManagement.onCreate(name);
        setModalState(null);
      }}
    />
    </>
  );
}
