import { useEffect, useState } from 'react';
import { ActivityIndicator, AccessibilityInfo, Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';

import { useOnboardingStore } from '@/features/onboarding';
import type { AccessibleRoute } from '@/features/route/domain';
import { useAppTranslation } from '@/shared/i18n';
import { useFontScale } from '@/shared/preferences';
import { RADIUS, TYPE, scaledSize, semanticColors, useThemeColors } from '@/shared/theme';
import { Icon } from '@/shared/ui';

import { explainRoute, type RouteExplanation } from '../api/explainApi';

export interface RouteExplanationCardProps {
  route: AccessibleRoute;
}

type ExplainState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; explanation: RouteExplanation }
  | { status: 'error' };

/**
 * 路線明細裡的「AI 路線分析」（對應 Web `RouteExplanationPanel.tsx`，`POST /ai/explain`）。
 * 與 Web 的差異：Web 開面板就自動呼叫；這裡等使用者按下才打（端點有 rate limit，路線明細頁常被快速切換）。
 * 換路線時重置。
 */
export default function RouteExplanationCard({ route }: RouteExplanationCardProps) {
  const { t, i18n } = useAppTranslation();
  const colors = useThemeColors();
  const tones = semanticColors(useColorScheme() === 'dark');
  const fontScale = useFontScale();
  const mode = useOnboardingStore((s) => s.profile.routeMode);
  const [state, setState] = useState<ExplainState>({ status: 'idle' });
  const [requested, setRequested] = useState<AccessibleRoute | null>(null);
  // 重試時 route 參照不變，靠遞增次數讓 effect 重跑
  const [attempt, setAttempt] = useState(0);
  const language = i18n.language === 'en' ? 'en' : 'zh-TW';

  useEffect(() => {
    if (requested !== route) return;
    const controller = new AbortController();
    const load = async () => {
      setState({ status: 'loading' });
      try {
        const explanation = await explainRoute(route, mode, language, controller.signal);
        if (controller.signal.aborted) return;
        setState({ status: 'ready', explanation });
        AccessibilityInfo.announceForAccessibility(explanation.summary);
      } catch (error) {
        if (controller.signal.aborted) return;
        console.warn('[ai] explain route failed', error);
        setState({ status: 'error' });
      }
    };
    void load();
    return () => controller.abort();
  }, [requested, route, mode, language, attempt]);

  const body = scaledSize(TYPE.callout, fontScale);
  const visible = requested === route ? state : { status: 'idle' as const };

  return (
    <View style={[styles.card, { backgroundColor: tones.accentSoft }]}>
      <View style={styles.header}>
        <Icon name="sparkles" size={18} color={tones.accent} />
        <Text accessibilityRole="header" style={[styles.title, { color: colors.text, fontSize: scaledSize(TYPE.body, fontScale) }]}>
          {t('aiExplanation')}
        </Text>
      </View>

      {visible.status === 'idle' || visible.status === 'error' ? (
        <>
          {visible.status === 'error' ? (
            <Text accessibilityRole="alert" style={{ color: tones.danger.fg, fontSize: body }}>
              {t('nativeAiExplainFailed')}
            </Text>
          ) : null}
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setRequested(route);
              setAttempt((n) => n + 1);
            }}
            style={({ pressed }) => [styles.button, { borderColor: tones.accent }, pressed && styles.pressed]}>
            <Text style={[styles.buttonText, { color: tones.accent, fontSize: body }]}>
              {visible.status === 'error' ? t('nativeAiExplainRetry') : t('nativeAiExplainAction')}
            </Text>
          </Pressable>
        </>
      ) : null}

      {visible.status === 'loading' ? (
        <View style={styles.loading} accessibilityLiveRegion="polite">
          <ActivityIndicator color={tones.accent} />
          <Text style={{ color: colors.textSecondary, fontSize: body }}>{t('assistThinking').trim()}</Text>
        </View>
      ) : null}

      {visible.status === 'ready' ? (
        <View style={styles.result}>
          <Text selectable style={{ color: colors.text, fontSize: body, lineHeight: Math.round(body * 1.45) }}>
            {visible.explanation.summary}
          </Text>
          {visible.explanation.accessibilityHighlights.map((highlight) => (
            <View key={highlight} style={styles.line}>
              <Icon name="accessibility" size={16} color={tones.ok.fg} />
              <Text style={[styles.lineText, { color: colors.text, fontSize: body }]}>{highlight}</Text>
            </View>
          ))}
          {visible.explanation.warnings.length > 0 ? (
            <>
              <Text style={[styles.subheading, { color: tones.warn.fg, fontSize: body }]}>{t('warnings')}</Text>
              {visible.explanation.warnings.map((warning) => (
                <View key={warning} style={styles.line}>
                  <Icon name="alert" size={16} color={tones.warn.fg} />
                  <Text style={[styles.lineText, { color: colors.text, fontSize: body }]}>{warning}</Text>
                </View>
              ))}
            </>
          ) : null}
          {visible.explanation.alternatives ? (
            <>
              <Text style={[styles.subheading, { color: colors.text, fontSize: body }]}>{t('alternatives')}</Text>
              <Text style={{ color: colors.textSecondary, fontSize: body }}>{visible.explanation.alternatives}</Text>
            </>
          ) : null}
          <Text style={[styles.disclaimer, { color: colors.textSecondary, fontSize: scaledSize(TYPE.caption, fontScale) }]}>
            {t('AIwarning')}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: RADIUS.card, padding: 14, gap: 10, marginBottom: 16 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontWeight: '700' },
  button: {
    alignSelf: 'flex-start',
    borderWidth: 1.5,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 16,
    minHeight: 40,
    justifyContent: 'center',
  },
  buttonText: { fontWeight: '600' },
  pressed: { opacity: 0.6 },
  loading: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 40 },
  result: { gap: 8 },
  line: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  lineText: { flex: 1 },
  subheading: { fontWeight: '700', marginTop: 4 },
  disclaimer: { marginTop: 4 },
});
