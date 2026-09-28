export type ButtonVariant = 'primary' | 'secondary' | 'destructive';

export interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  /** 附加在 accessibilityLabel 後面的補充說明（例如「需要網路連線」）。 */
  accessibilityHint?: string;
}
