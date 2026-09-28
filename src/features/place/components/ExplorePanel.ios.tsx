import { Button, Form, HStack, Host, ProgressView, Section, Spacer, Text, TextField, type TextFieldRef, VStack } from '@expo/ui/swift-ui';
import { accessibilityLabel, buttonStyle, disabled, font, foregroundStyle } from '@expo/ui/swift-ui/modifiers';
import { useEffect, useRef } from 'react';

import type { ExplorePanelProps } from './ExplorePanel.types';

/**
 * sheet 最低 detent 只露出約 15% 畫面，所以搜尋框必須是 `Form` 的第一列
 * （SDD §4.5、brief §5）——不能像 RN fallback 舊版那樣跟結果列表分開排版。
 *
 * `TextField` 讓欄位自己管理內部文字狀態（不傳 `text`）；`model.query`
 * 被外部清空時（選定地點後 view-model 呼叫 `setQuery('')`）改用
 * `TextFieldRef.clear()` 命令式清空——用受控的 `ObservableState` 直接
 * `.value = ...` 寫入會被 React Compiler 的 `react-hooks/immutability`
 * 規則擋下（"Modifying a value returned from a hook is not allowed"）。
 */
export default function ExplorePanel({ model }: ExplorePanelProps) {
  const fieldRef = useRef<TextFieldRef>(null);
  const previousQuery = useRef(model.query);
  useEffect(() => {
    if (model.query === '' && previousQuery.current !== '') {
      void fieldRef.current?.clear();
    }
    previousQuery.current = model.query;
  }, [model.query]);

  return (
    <Host style={{ flex: 1 }}>
      <Form>
        <Section>
          <TextField
            ref={fieldRef}
            placeholder={model.labels.searchPlaceholder}
            onTextChange={model.onQueryChange}
            modifiers={[accessibilityLabel(model.labels.searchPlaceholder)]}
          />
        </Section>

        {model.mode === 'history' ? (
          <>
            <Section>
              <Button
                label={model.labels.nearbyA11y}
                systemImage="figure.roll"
                onPress={model.onOpenNearby}
                modifiers={[buttonStyle('plain')]}
              />
              <Button
                label={model.labels.savedPlaces}
                systemImage="bookmark"
                onPress={model.onOpenSaved}
                modifiers={[buttonStyle('plain')]}
              />
            </Section>
            {model.historyRows.length > 0 ? (
              <Section title={model.labels.searchHistory}>
                {model.historyRows.map((row) => (
                  <Button key={row.key} onPress={row.onPress} modifiers={[buttonStyle('plain')]}>
                    <Text>{row.title}</Text>
                  </Button>
                ))}
              </Section>
            ) : null}
          </>
        ) : (
          <Section title={model.labels.searchResults}>
            {model.loading ? <ProgressView /> : null}
            {!model.loading && model.resultRows.length === 0 ? <Text>{model.labels.noResults}</Text> : null}
            {model.resultRows.map((row) => (
              <Button
                key={row.key}
                onPress={row.onPress}
                modifiers={[
                  buttonStyle('plain'),
                  disabled(row.disabled),
                  accessibilityLabel(row.subtitle ? `${row.title}，${row.subtitle}` : row.title),
                ]}>
                <HStack>
                  <VStack alignment="leading" spacing={2}>
                    <Text modifiers={[foregroundStyle({ type: 'hierarchical', style: 'primary' })]}>{row.title}</Text>
                    {row.subtitle ? (
                      <Text
                        modifiers={[
                          font({ textStyle: 'footnote' }),
                          foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
                        ]}>
                        {row.subtitle}
                      </Text>
                    ) : null}
                  </VStack>
                  <Spacer />
                  {row.resolving ? <ProgressView /> : null}
                </HStack>
              </Button>
            ))}
          </Section>
        )}
      </Form>
    </Host>
  );
}
