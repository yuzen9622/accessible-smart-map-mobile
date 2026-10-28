import { Easing, ReduceMotion } from 'react-native-reanimated';

/** 動態 token：曲線只有 ease-out／ease-in-out／linear，所有動畫都跟隨系統「降低動態」。 */
const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
const EASE_IN_OUT = Easing.bezier(0.77, 0, 0.175, 1);

export const MOTION = {
  press: { duration: 120, easing: EASE_OUT, reduceMotion: ReduceMotion.System },
  small: { duration: 180, easing: EASE_OUT, reduceMotion: ReduceMotion.System },
  medium: { duration: 240, easing: EASE_OUT, reduceMotion: ReduceMotion.System },
  move: { duration: 280, easing: EASE_IN_OUT, reduceMotion: ReduceMotion.System },
  settle: { duration: 400, dampingRatio: 1, reduceMotion: ReduceMotion.System },
  snap: { duration: 300, dampingRatio: 0.8, reduceMotion: ReduceMotion.System },
} as const;

/** 即時脈動、思考中的循環週期（ms）。 */
export const AMBIENT_MS = 1600;
