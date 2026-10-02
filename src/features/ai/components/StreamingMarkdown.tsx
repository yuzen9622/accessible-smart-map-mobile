import { Linking, StyleSheet } from 'react-native';
import { EnrichedMarkdownText, type LinkPressEvent, type MarkdownStyle } from 'react-native-enriched-markdown';
import { useReducedMotion } from 'react-native-reanimated';
import remend from 'remend';

import { useAppTranslation } from '@/shared/i18n';
import { logger } from '@/shared/logger';
import { useFontScale } from '@/shared/preferences';
import { RADIUS, TYPE, scaledSize, useSemanticColors, useThemeColors } from '@/shared/theme';

import { useSmoothStream } from '../hooks/useSmoothStream';

export interface StreamingMarkdownProps {
  content: string;
  streaming: boolean;
  isDark: boolean;
}

/** 只放行 http(s)／mailto／tel：AI 回覆是不受信任的內容（對應 Web `rehype-sanitize`）。 */
const SAFE_LINK = /^(https?:|mailto:|tel:)/i;

async function openLink({ url }: LinkPressEvent): Promise<void> {
  if (!SAFE_LINK.test(url)) return;
  try {
    await Linking.openURL(url);
  } catch (error) {
    logger.warn('[ai] open link failed', error);
  }
}

/**
 * AI 回覆的 markdown（對應 Web `StreamingMarkdown.tsx`＋`MarkdownText.tsx`）。
 *
 * - 渲染：`react-native-enriched-markdown`（原生 md4c，GFM 表格／清單；VoiceOver 逐段、連結可獨立聚焦）。
 * - 串流：`useSmoothStream` 平滑前緣；未寫完的 `**粗體`、半截連結用 `remend` 補齊，避免 md4c 把語法字元
 *   原樣畫出來再跳成格式（Web 的 blur-tail 在這裡由原生 `streamingAnimation` 的尾端淡入取代）。
 * - 減少動態效果：不平滑、不淡入，到貨就整段顯示。
 */
export default function StreamingMarkdown({ content, streaming, isDark }: StreamingMarkdownProps) {
  const reduceMotion = useReducedMotion();
  const colors = useThemeColors();
  const tones = useSemanticColors();
  const fontScale = useFontScale();
  const { t } = useAppTranslation();
  const animate = streaming && !reduceMotion;
  const revealed = useSmoothStream(content, { enabled: animate });
  const markdown = streaming ? remend(revealed) : content;

  const body = scaledSize(TYPE.body, fontScale);
  const markdownStyle: MarkdownStyle = {
    paragraph: { fontSize: body, color: colors.text, lineHeight: Math.round(body * 1.45), marginBottom: 8 },
    h1: { fontSize: scaledSize(TYPE.headline, fontScale), color: colors.text, fontWeight: '700', marginBottom: 8 },
    h2: { fontSize: scaledSize(18, fontScale), color: colors.text, fontWeight: '700', marginBottom: 6 },
    h3: { fontSize: body, color: colors.text, fontWeight: '700', marginBottom: 4 },
    list: { fontSize: body, color: colors.text, bulletColor: colors.textSecondary, markerColor: colors.textSecondary },
    link: { color: tones.accent },
    strong: { color: colors.text },
    code: { color: colors.text, backgroundColor: tones.surface },
    codeBlock: { fontSize: scaledSize(TYPE.subhead, fontScale), color: colors.text, backgroundColor: tones.surface, borderRadius: RADIUS.small },
    blockquote: { color: colors.textSecondary, borderColor: tones.separator },
    table: { fontSize: scaledSize(TYPE.callout, fontScale), color: colors.text, borderColor: tones.separator },
  };

  return (
    <EnrichedMarkdownText
      markdown={markdown}
      flavor="github"
      markdownStyle={markdownStyle}
      containerStyle={styles.container}
      streamingAnimation={animate}
      streamingConfig={{ tableMode: 'hidden', codeBlockMode: 'progressive' }}
      md4cFlags={{ latexMath: false }}
      onLinkPress={(event) => void openLink(event)}
      selectable
      accessibilityLabels={{
        list: {
          bulletPoint: t('nativeAiA11yBullet'),
          nestedBulletPoint: t('nativeAiA11yNestedBullet'),
          orderedItem: t('nativeAiA11yOrderedItem'),
          nestedOrderedItem: t('nativeAiA11yNestedOrderedItem'),
        },
        blockquote: { quote: t('nativeAiA11yQuote'), nestedQuote: t('nativeAiA11yNestedQuote') },
        table: { row: t('nativeAiA11yTableRow') },
        rotor: { headings: t('nativeAiA11yRotorHeadings'), links: t('nativeAiA11yRotorLinks'), images: t('nativeAiA11yRotorImages') },
      }}
    />
  );
}

const styles = StyleSheet.create({
  container: { alignSelf: 'stretch' },
});
