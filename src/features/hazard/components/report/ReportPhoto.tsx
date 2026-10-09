import { Image } from 'expo-image';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { useAuthStore } from '@/features/auth';
import { useAppTranslation } from '@/shared/i18n';
import { MAX_FONT_SCALE, RADIUS, TYPE, useThemeColors } from '@/shared/theme';
import { Icon } from '@/shared/ui';

import { logger } from '@/shared/logger';

import { hazardPhotoSource, recoverHazardPhotoSource } from '../../api/hazardApi';
import { ActionButton } from './reportUi';

interface ReportPhotoProps {
  reportId: string;
  variant: 'thumbnail' | 'detail';
}

/**
 * 回報照片（Web `HazardReportPhoto`）：由後端 `/reports/:id/photo` 帶 token 取得 bytes。
 * 列表縮圖載入失敗只顯示佔位；詳情提供重試。換帳號時以 key 重建，不沿用上一個帳號的圖。
 */
export default function ReportPhoto(props: ReportPhotoProps) {
  const userId = useAuthStore((s) => s.user?._id ?? 'anonymous');
  return <PhotoSession key={`${userId}:${props.reportId}`} {...props} />;
}

function PhotoSession({ reportId, variant }: ReportPhotoProps) {
  const { t } = useAppTranslation();
  const colors = useThemeColors();
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<'loading' | 'loaded' | 'failed'>('loading');
  // token 只在建立與重試時讀（不在 render 讀，避免 React Compiler 快取到過期 token）
  const [source, setSource] = useState(() => hazardPhotoSource(reportId));
  const [recovering, setRecovering] = useState(false);
  const [recovered, setRecovered] = useState(false);
  const failed = state === 'failed' || source === null;

  // 第一次失敗自動補救一次（換 token／refresh 後重載）；之後才顯示「無法載入」
  const handleError = () => {
    if (recovered || recovering) {
      setState('failed');
      return;
    }
    setRecovering(true);
    const run = async () => {
      try {
        const next = await recoverHazardPhotoSource(reportId);
        if (next) {
          setSource(next);
          setAttempt((n) => n + 1);
        } else {
          setState('failed');
        }
      } catch (error) {
        logger.warn('[hazard] photo recover failed', error);
        setState('failed');
      } finally {
        setRecovered(true);
        setRecovering(false);
      }
    };
    void run();
  };

  const retry = () => {
    setRecovered(false);
    setState('loading');
    setSource(hazardPhotoSource(reportId));
    setAttempt((n) => n + 1);
  };
  const frame = variant === 'detail' ? styles.detail : styles.thumbnail;

  return (
    <View style={variant === 'detail' ? styles.detailWrap : undefined}>
      <View style={[frame, { backgroundColor: colors.backgroundElement }]}>
        {source && !failed ? (
          <Image
            key={attempt}
            source={source}
            cachePolicy="none"
            contentFit={variant === 'detail' ? 'contain' : 'cover'}
            transition={150}
            style={StyleSheet.absoluteFill}
            accessibilityLabel={t('hazardPhoto')}
            onLoad={() => setState('loaded')}
            onError={handleError}
          />
        ) : null}
        {state !== 'loaded' ? (
          <View style={styles.placeholder} accessible accessibilityRole="text" accessibilityLabel={t(failed ? 'hazardPhotoUnavailable' : 'hazardPhotoLoading')}>
            {failed ? <Icon name="image" size={variant === 'detail' ? 28 : 22} color={colors.textSecondary} /> : <ActivityIndicator />}
            {variant === 'detail' ? (
              <Text maxFontSizeMultiplier={MAX_FONT_SCALE.label} style={[styles.placeholderText, { color: colors.textSecondary }]}>
                {t(failed ? 'hazardPhotoUnavailable' : 'hazardPhotoLoading')}
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>
      {failed && variant === 'detail' ? (
        <ActionButton
          label={t('myReportsRetry')}
          icon="refresh"
          variant="secondary"
          onPress={retry}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  thumbnail: { width: 76, height: 76, borderRadius: RADIUS.small, overflow: 'hidden' },
  detailWrap: { gap: 10 },
  detail: { width: '100%', aspectRatio: 4 / 3, borderRadius: RADIUS.card, overflow: 'hidden' },
  placeholder: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', gap: 6, padding: 8 },
  placeholderText: { fontSize: TYPE.subhead, textAlign: 'center' },
});
