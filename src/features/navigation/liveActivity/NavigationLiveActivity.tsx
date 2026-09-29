import { HStack, Image, ProgressView, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { font, foregroundStyle, lineLimit, monospacedDigit, padding } from '@expo/ui/swift-ui/modifiers';
import { createLiveActivity, type LiveActivityEnvironment } from 'expo-widgets';
import type { SFSymbol } from 'expo-symbols';

/**
 * 導航 Live Activity（SDD §4.5「鎖定畫面與即時動態」、§6.4）：鎖定畫面卡片＋動態島 compact／expanded／minimal。
 *
 * 限制（`expo-widgets` 的 `'widget'` runtime）：只能用 `@expo/ui/swift-ui`、不能 import 其他模組或讀
 * 模組層常數，所以所有文字在 App 端依 i18n 組好後以 props 傳入。也因此轉向圖示用 SF Symbol 而非 Lucide
 * （widget extension 內沒有 RN／SVG；SDD ADR-16 的例外，對照表在 `liveActivityPort.ios.ts`）。
 */
export interface NavigationActivityProps {
  symbol: SFSymbol;
  instruction: string;
  /** 已格式化的下一步距離（例：「120 m」）；沒有時為空字串。 */
  distance: string;
  /** 「預計 14:05 抵達」 */
  eta: string;
  /** 「剩 12 分」 */
  remaining: string;
  /** 0–1；未知時為 -1（props 必須可 JSON 序列化，不用 null）。 */
  progress: number;
  rerouting: boolean;
  reroutingText: string;
}

const NavigationActivity = (props: NavigationActivityProps, environment: LiveActivityEnvironment) => {
  'widget';
  const accent = environment.isLuminanceReduced ? '#FFFFFF' : '#34C759';
  const symbol = props.rerouting ? 'arrow.triangle.2.circlepath' : props.symbol;
  const headline = props.rerouting ? props.reroutingText : props.instruction;
  return {
    banner: (
      <VStack alignment="leading" spacing={8} modifiers={[padding({ all: 14 })]}>
        <HStack spacing={12}>
          <Image systemName={symbol} size={34} color={accent} />
          <VStack alignment="leading" spacing={2}>
            {props.rerouting || !props.distance ? null : (
              <Text modifiers={[font({ size: 26, weight: 'bold' }), monospacedDigit()]}>{props.distance}</Text>
            )}
            <Text modifiers={[font({ size: 15, weight: 'semibold' }), lineLimit(2)]}>{headline}</Text>
          </VStack>
          <Spacer />
        </HStack>
        {props.progress >= 0 ? <ProgressView value={props.progress} /> : null}
        <HStack>
          <Text modifiers={[font({ size: 13 }), foregroundStyle('#8E8E93')]}>{props.eta}</Text>
          <Spacer />
          <Text modifiers={[font({ size: 13, weight: 'semibold' }), foregroundStyle(accent)]}>{props.remaining}</Text>
        </HStack>
      </VStack>
    ),
    compactLeading: <Image systemName={symbol} color={accent} />,
    compactTrailing: (
      <Text modifiers={[font({ size: 14, weight: 'semibold' }), monospacedDigit()]}>{props.rerouting ? '…' : props.distance}</Text>
    ),
    minimal: <Image systemName={symbol} color={accent} />,
    expandedLeading: (
      <VStack modifiers={[padding({ all: 8 })]}>
        <Image systemName={symbol} size={30} color={accent} />
      </VStack>
    ),
    expandedTrailing: (
      <VStack alignment="trailing" modifiers={[padding({ all: 8 })]}>
        <Text modifiers={[font({ size: 20, weight: 'bold' }), monospacedDigit()]}>{props.rerouting ? '' : props.distance}</Text>
        <Text modifiers={[font({ size: 12 }), foregroundStyle('#8E8E93')]}>{props.remaining}</Text>
      </VStack>
    ),
    expandedBottom: (
      <VStack alignment="leading" spacing={6} modifiers={[padding({ horizontal: 12, bottom: 8 })]}>
        <Text modifiers={[font({ size: 15, weight: 'semibold' }), lineLimit(2)]}>{headline}</Text>
        {props.progress >= 0 ? <ProgressView value={props.progress} /> : null}
        <Text modifiers={[font({ size: 12 }), foregroundStyle('#8E8E93')]}>{props.eta}</Text>
      </VStack>
    ),
  };
};

export default createLiveActivity<NavigationActivityProps>('NavigationActivity', NavigationActivity);
