import { Button, ProgressView, Text } from '@expo/ui/swift-ui';
import {
  accessibilityHint,
  accessibilityLabel,
  bold,
  buttonBorderShape,
  buttonStyle,
  controlSize,
  disabled as disabledModifier,
  frame,
  listRowBackground,
  listRowInsets,
  listRowSeparator,
  tint,
} from '@expo/ui/swift-ui/modifiers';

import { useAppTranslation } from '@/shared/i18n';
import { ACCENT_FILL, DANGER_FILL } from '@/shared/theme';

import type { FormPrimaryButtonProps, FormSecondaryButtonProps } from './FormPrimaryButton.types';

function ignorePress(): void {}

/** 按鈕列不畫 Form 的白色列底與分隔線：主、次按鈕放在同一段時才不會出現「半張白卡＋一條線」。 */
const BARE_ROW = [
  listRowBackground('clear'),
  listRowSeparator('hidden'),
  listRowInsets({ top: 4, leading: 0, bottom: 4, trailing: 0 }),
];

/**
 * SwiftUI `Form` 裡的主要動作按鈕：整列寬、大尺寸、膠囊形，不包在白色卡片裡。
 * 取代原本直接放 `Button` + `borderedProminent` 的寫法——那在 Form 裡只會是靠左的一顆小藥丸，
 * 看起來像次要動作（登入、更新密碼、送出評價、立即綁定都是這樣）。
 * `maxWidth` 用大數字而不是 Infinity：確定能穿過原生橋接，效果一樣（會被列寬限制）。
 */
export default function FormPrimaryButton({
  label,
  onPress,
  disabled,
  loading,
  loadingHint,
  tone = 'accent',
}: FormPrimaryButtonProps) {
  const { t } = useAppTranslation();
  const hint = loadingHint ?? t('nativeProcessing');
  return (
    <Button
      // 送出中「不」停用：停用的實心按鈕會變淺灰，白色轉圈在上面看不見。改成點了沒反應，膠囊維持主色。
      onPress={loading ? ignorePress : onPress}
      modifiers={[
        buttonStyle('borderedProminent'),
        controlSize('large'),
        buttonBorderShape('capsule'),
        tint(tone === 'destructive' ? DANGER_FILL : ACCENT_FILL),
        disabledModifier(!!disabled),
        // 送出中按鈕裡只剩轉圈：名稱要另外給 VoiceOver，並提示正在處理
        accessibilityLabel(label),
        ...(loading ? [accessibilityHint(hint)] : []),
        ...BARE_ROW,
      ]}>
      {loading ? (
        <ProgressView modifiers={[frame({ maxWidth: 10000 }), tint('white')]} />
      ) : (
        <Text modifiers={[frame({ maxWidth: 10000 }), bold()]}>{label}</Text>
      )}
    </Button>
  );
}

/** 跟在主要按鈕下面的次要動作：整列置中的純文字按鈕，同樣不畫列底與分隔線。 */
export function FormSecondaryButton({ label, onPress, disabled }: FormSecondaryButtonProps) {
  return (
    <Button onPress={onPress} modifiers={[disabledModifier(!!disabled), ...BARE_ROW]}>
      <Text modifiers={[frame({ maxWidth: 10000, minHeight: 44 })]}>{label}</Text>
    </Button>
  );
}
