import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useThemeColors } from '@/shared/theme';
import { Button } from '@/shared/ui';

import type { OnboardingPanelProps } from './OnboardingPanel.types';

export default function OnboardingPanel({ model, backLabel, skipLabel }: OnboardingPanelProps) {
  const colors = useThemeColors();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        {model.canGoBack ? (
          <Pressable
            onPress={model.onBack}
            accessibilityRole="button"
            accessibilityLabel={backLabel}
            style={styles.headerButton}>
            <Text style={{ color: colors.textSecondary }}>{backLabel}</Text>
          </Pressable>
        ) : (
          <View style={styles.headerButton} />
        )}
        <Text
          accessibilityLiveRegion="polite"
          style={[styles.progress, { color: colors.textSecondary }]}>
          {model.progressText}
        </Text>
        <Pressable
          onPress={model.onSkip}
          accessibilityRole="button"
          accessibilityLabel={skipLabel}
          style={styles.headerButton}>
          <Text style={{ color: colors.textSecondary }}>{skipLabel}</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {model.stepId === 'intro' && (
          <View>
            <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
              {model.intro.title}
            </Text>
            <Text style={[styles.body, { color: colors.textSecondary }]}>{model.intro.body}</Text>
            <Button label={model.intro.startLabel} onPress={model.intro.onStart} />
          </View>
        )}

        {model.stepId === 'needs' && (
          <View>
            <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
              {model.needs.title}
            </Text>
            <Text style={[styles.body, { color: colors.textSecondary }]}>{model.needs.subtitle}</Text>
            <View style={styles.grid}>
              {model.needs.options.map((option) => (
                <Pressable
                  key={option.id}
                  onPress={() => model.needs.onToggle(option.id)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: option.selected }}
                  accessibilityLabel={`${option.label}，${option.description}`}
                  style={[
                    styles.card,
                    {
                      backgroundColor: option.selected ? colors.text : colors.backgroundElement,
                      borderColor: colors.textSecondary,
                    },
                  ]}>
                  <Text
                    style={[styles.cardTitle, { color: option.selected ? colors.background : colors.text }]}>
                    {option.label}
                  </Text>
                  <Text
                    style={[
                      styles.cardDesc,
                      { color: option.selected ? colors.background : colors.textSecondary },
                    ]}>
                    {option.description}
                  </Text>
                </Pressable>
              ))}
            </View>
            {model.needs.derivedModeText ? (
              <Text accessibilityLiveRegion="polite" style={[styles.hint, { color: colors.textSecondary }]}>
                {model.needs.derivedModeText}
              </Text>
            ) : null}
            <Text style={[styles.hint, { color: colors.textSecondary }]}>{model.needs.hint}</Text>
            <Button label={model.needs.nextLabel} onPress={model.needs.onNext} />
          </View>
        )}

        {model.stepId === 'location' && (
          <View>
            <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
              {model.location.title}
            </Text>
            {model.location.benefits.map((benefit) => (
              <Text key={benefit} style={[styles.body, { color: colors.text }]}>
                {`• ${benefit}`}
              </Text>
            ))}
            <Text style={[styles.hint, { color: colors.textSecondary }]}>{model.location.privacy}</Text>
            <View accessibilityLiveRegion="polite" style={styles.outcome}>
              {model.location.outcomeText ? (
                <Text style={{ color: colors.text }}>{model.location.outcomeText}</Text>
              ) : null}
            </View>
            {model.location.state === 'granted' ||
            model.location.state === 'denied' ||
            model.location.state === 'unsupported' ? (
              <Button label={model.location.nextLabel} onPress={model.location.onNext} />
            ) : (
              <>
                {model.location.state === 'requesting' ? (
                  <ActivityIndicator accessibilityLabel={model.location.requestingLabel} />
                ) : (
                  <Button label={model.location.allowLabel} onPress={model.location.onRequest} />
                )}
                <Pressable
                  onPress={model.location.onNext}
                  accessibilityRole="button"
                  accessibilityLabel={model.location.manualLabel}
                  style={styles.headerButton}>
                  <Text style={{ color: colors.textSecondary }}>{model.location.manualLabel}</Text>
                </Pressable>
              </>
            )}
          </View>
        )}

        {model.stepId === 'done' && (
          <View>
            <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
              {model.done.title}
            </Text>
            <Button label={model.done.tryToiletLabel} onPress={model.done.onTryToilet} />
            <Button label={model.done.startLabel} variant="secondary" onPress={model.done.onStart} />
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingTop: 12,
  },
  headerButton: { minHeight: 44, minWidth: 44, justifyContent: 'center', paddingHorizontal: 8 },
  progress: { fontSize: 13 },
  content: { padding: 20, gap: 12 },
  title: { fontSize: 24, fontWeight: '700' },
  body: { fontSize: 15, lineHeight: 22 },
  hint: { fontSize: 13, lineHeight: 18 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: {
    width: '47%',
    minHeight: 104,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    gap: 6,
  },
  cardTitle: { fontSize: 15, fontWeight: '600' },
  cardDesc: { fontSize: 12, lineHeight: 16 },
  outcome: { minHeight: 20 },
});
