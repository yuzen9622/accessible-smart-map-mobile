import { Image } from 'expo-image';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useAppTranslation } from '@/shared/i18n';
import { MAX_FONT_SCALE, SPACE, TYPE, useThemeColors, SHAPE } from '@/shared/theme';
import { Icon } from '@/shared/ui';
import { Text } from '@/shared/ui/typography/Text';

import { publicHazardPhotoSource } from '../../api/hazardApi';
import { ActionButton } from './reportUi';

/** 公開詳情專用；不接收 reportId，不可能退回帶 token 的私人照片讀取。 */
export default function PublicReportPhoto({ url, onRefresh }: { url: string; onRefresh: () => void }) {
  return <PublicPhotoSession key={url} url={url} onRefresh={onRefresh} />;
}

function PublicPhotoSession({ url, onRefresh }: { url: string; onRefresh: () => void }) {
  const { t } = useAppTranslation();
  const colors = useThemeColors();
  const [state, setState] = useState<'loading' | 'loaded' | 'failed'>('loading');
  const [attempt, setAttempt] = useState(0);
  const source = publicHazardPhotoSource(url);
  const failed = state === 'failed' || source === null;

  const retry = () => {
    // 只由使用者明確重試：重新讀 DTO，同時重載同一公開入口，不做私人 fallback。
    onRefresh();
    setState('loading');
    setAttempt((value) => value + 1);
  };

  return (
    <View style={styles.wrap}>
      <View style={[failed ? styles.unavailable : styles.frame, { backgroundColor: colors.backgroundElement }]}>
        {!failed && source ? (
          <Image
            key={attempt}
            source={source}
            cachePolicy="none"
            contentFit="contain"
            style={StyleSheet.absoluteFill}
            accessibilityLabel={t('hazardPhoto')}
            onLoad={() => setState('loaded')}
            onError={() => setState('failed')}
          />
        ) : null}
        {state !== 'loaded' || failed ? (
          <View style={failed ? styles.failedContent : styles.placeholder}>
            {failed ? <Icon name="image" size={28} color={colors.textSecondary} /> : <ActivityIndicator />}
            <Text maxFontSizeMultiplier={MAX_FONT_SCALE.body} style={[styles.label, { color: colors.textSecondary }]}>
              {t(failed ? 'hazardPublicPhotoUnavailable' : 'hazardPhotoLoading')}
            </Text>
          </View>
        ) : null}
      </View>
      {failed ? <ActionButton label={t('retry')} variant="secondary" icon="refresh" onPress={retry} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: SPACE.sm },
  frame: { width: '100%', aspectRatio: 4 / 3, borderRadius: SHAPE.card, borderCurve: 'continuous', overflow: 'hidden' },
  unavailable: { borderRadius: SHAPE.card, borderCurve: 'continuous', overflow: 'hidden' },
  failedContent: { minHeight: 128, padding: SPACE.lg, gap: SPACE.sm, alignItems: 'center', justifyContent: 'center' },
  placeholder: { ...StyleSheet.absoluteFill, padding: SPACE.lg, gap: SPACE.sm, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: TYPE.footnote, textAlign: 'center' },
});
