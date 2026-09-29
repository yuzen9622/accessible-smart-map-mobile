import { Button, Form, Host, Picker, ProgressView, RNHostView, Section, Text, TextField, useNativeState } from '@expo/ui/swift-ui';
import { buttonStyle, disabled, font, foregroundStyle, lineLimit, pickerStyle, tag } from '@expo/ui/swift-ui/modifiers';
import { Image } from 'expo-image';
import { StyleSheet, View, useWindowDimensions } from 'react-native';

import { useAppTranslation } from '@/shared/i18n';

import type { HazardReportPanelProps } from './HazardReportPanel.types';

const secondary = [font({ textStyle: 'footnote' }), foregroundStyle({ type: 'hierarchical', style: 'secondary' })];

/** iOS：SwiftUI Form；照片預覽以 RNHostView 嵌入 expo-image。 */
export default function HazardReportPanel({ model }: HazardReportPanelProps) {
  const { t } = useAppTranslation();
  const descriptionState = useNativeState(model.description);
  // RNHostView matchContents 以子元件尺寸為準，百分比寬度會解析成 0：以視窗寬扣掉 Form 左右內距
  const previewWidth = useWindowDimensions().width - 72;
  return (
    <Host style={{ flex: 1 }}>
      <Form>
        {!model.loggedIn ? (
          <Section>
            <Text modifiers={secondary}>{t('reportLoginHint')}</Text>
            <Button label={t('loginRegisterCta')} onPress={model.login} />
          </Section>
        ) : null}

        <Section title={t('hazardType')}>
          <Picker<string>
            selection={model.hazardType}
            onSelectionChange={(v) => {
              const choice = model.typeChoices.find((c) => c.value === v);
              if (choice) model.setHazardType(choice.value);
            }}
            modifiers={[pickerStyle('segmented')]}>
            {model.typeChoices.map((c) => (
              <Text key={c.value} modifiers={[tag(c.value)]}>
                {c.label}
              </Text>
            ))}
          </Picker>
        </Section>

        <Section title={t('hazardSeverity')}>
          <Picker<string>
            selection={model.severity}
            onSelectionChange={(v) => {
              const choice = model.severityChoices.find((c) => c.value === v);
              if (choice) model.setSeverity(choice.value);
            }}
            modifiers={[pickerStyle('segmented')]}>
            {model.severityChoices.map((c) => (
              <Text key={c.value} modifiers={[tag(c.value)]}>
                {c.label}
              </Text>
            ))}
          </Picker>
        </Section>

        <Section title={t('hazardPhoto')} footer={<Text>{t('photoRequirementHint')}</Text>}>
          {model.photo ? (
            <>
              <RNHostView matchContents>
                <View style={[styles.previewWrap, { width: previewWidth }]}>
                  <Image
                    source={{ uri: model.photo.uri }}
                    style={[styles.preview, { width: previewWidth }]}
                    contentFit="cover"
                    accessibilityLabel={t('hazardPhoto')}
                  />
                </View>
              </RNHostView>
              <Button label={t('nativeHazardRemovePhoto')} role="destructive" onPress={model.removePhoto} />
            </>
          ) : null}
          <Button label={t('takePhoto')} onPress={model.takePhoto} />
          <Button label={t('nativeHazardChooseFromLibrary')} onPress={model.chooseFromLibrary} />
        </Section>

        <Section title={t('hazardDesc')}>
          <TextField
            text={descriptionState}
            placeholder={t('hazardDescPlaceholder')}
            axis="vertical"
            maxLength={500}
            onTextChange={model.setDescription}
            modifiers={[lineLimit(6, { reservesSpace: true })]}
          />
        </Section>

        <Section title={t('sosCurrentLocation')}>
          <Text>{model.locationPrimary}</Text>
          {model.locationSecondary ? <Text modifiers={secondary}>{model.locationSecondary}</Text> : null}
        </Section>

        <Section>
          {model.submitting ? (
            <ProgressView />
          ) : (
            <Button
              label={t('submitReport')}
              onPress={model.submit}
              modifiers={[buttonStyle('borderedProminent'), disabled(!model.canSubmit)]}
            />
          )}
        </Section>
      </Form>
    </Host>
  );
}

const styles = StyleSheet.create({
  previewWrap: { paddingVertical: 4 },
  preview: { height: 200, borderRadius: 12 },
});
