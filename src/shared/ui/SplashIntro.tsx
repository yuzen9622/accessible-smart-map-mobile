import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { StyleSheet, useColorScheme } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { useAppTranslation } from '@/shared/i18n';

import { useSplashStore } from './splashStore';
import { SPLASH_BG, BLACK, WHITE, TYPE } from '@/shared/theme';
import { MOTION } from '@/shared/theme/motion';

const LIGHT_BG = SPLASH_BG;
const DARK_BG = BLACK;

/**
 * 原生 Splash（靜態圖，技術上無法做動畫）之後接的短動畫過渡畫面：logo 淡入放大、App 標語淡入，
 * 停留後整體淡出進首頁（使用者回饋 2026-10-11：原本啟動畫面太單調）。背景色與 icon 跟 app.json
 * 的 `expo-splash-screen` 設定一致，從原生 Splash 接手時視覺上不會跳一下。
 *
 * 必須搭配 root layout 最上層呼叫 `SplashScreen.preventAutoHideAsync()`（模組層級、越早越好），
 * 這裡 mount 後立刻 `hideAsync()` 接手，原生 Splash 消失的瞬間畫面長得一樣，再開始動畫。
 */
export default function SplashIntro() {
  const { t } = useAppTranslation();
  const scheme = useColorScheme();
  const reduceMotion = useReducedMotion();
  const [done, setDone] = useState(false);
  const overlayOpacity = useSharedValue(1);
  const logoOpacity = useSharedValue(0);
  const logoScale = useSharedValue(0.92);
  const taglineOpacity = useSharedValue(0);

  useEffect(() => {
    void SplashScreen.hideAsync();
    // 一般 JS function（非 worklet）：`finish` 跑在 UI thread，worklet 裡不能直接呼叫
    // `useSplashStore.getState()`（store 物件在 UI thread 不存在），要經 `runOnJS` 轉回 JS thread 呼叫。
    const markSplashDone = () => useSplashStore.getState().markDone();
    const finish = () => {
      'worklet';
      runOnJS(setDone)(true);
      runOnJS(markSplashDone)();
    };
    if (reduceMotion) {
      logoOpacity.value = 1;
      taglineOpacity.value = 1;
      overlayOpacity.value = withDelay(260, withTiming(0, { duration: MOTION.small.duration }, (finished) => finished && finish()));
      return;
    }
    logoOpacity.value = withTiming(1, { duration: MOTION.medium.duration });
    logoScale.value = withTiming(1, { duration: MOTION.medium.duration, easing: MOTION.medium.easing });
    taglineOpacity.value = withDelay(220, withTiming(1, { duration: MOTION.medium.duration }));
    overlayOpacity.value = withDelay(900, withTiming(0, { duration: MOTION.move.duration }, (finished) => finished && finish()));
  }, [reduceMotion, logoOpacity, logoScale, overlayOpacity, taglineOpacity]);

  const overlayStyle = useAnimatedStyle(() => ({ opacity: overlayOpacity.value }));
  const logoStyle = useAnimatedStyle(() => ({ opacity: logoOpacity.value, transform: [{ scale: logoScale.value }] }));
  const taglineStyle = useAnimatedStyle(() => ({ opacity: taglineOpacity.value }));

  if (done) return null;

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.container, { backgroundColor: scheme === 'dark' ? DARK_BG : LIGHT_BG }, overlayStyle]}>
      <Animated.Image
        source={
          scheme === 'dark'
            ? require('../../../assets/images/splash-icon-dark.png')
            : require('../../../assets/images/splash-icon.png')
        }
        style={[styles.logo, logoStyle]}
        resizeMode="contain"
      />
      <Animated.Text style={[styles.tagline, taglineStyle]}>{t('title')}</Animated.Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', zIndex: 999 },
  logo: { width: 120, height: 120 },
  tagline: { marginTop: 16, fontSize: TYPE.subhead, fontWeight: '600', color: WHITE, letterSpacing: 0.3 },
});
