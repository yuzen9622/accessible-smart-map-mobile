import { FormButton } from './Form';
import type { FormPrimaryButtonProps, FormSecondaryButtonProps } from './FormPrimaryButton.types';

/** 非 iOS：沿用 RN 的 `FormButton`（本元件只在 SwiftUI `Form` 內使用）。 */
export default function FormPrimaryButton({ label, onPress, disabled, loading, tone = 'accent' }: FormPrimaryButtonProps) {
  return (
    <FormButton label={label} onPress={onPress} disabled={disabled} loading={loading} variant={tone === 'destructive' ? 'destructive' : 'primary'} />
  );
}

export function FormSecondaryButton({ label, onPress, disabled }: FormSecondaryButtonProps) {
  return <FormButton label={label} onPress={onPress} disabled={disabled} variant="secondary" />;
}
