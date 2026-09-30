export interface SegmentedControlOption<T extends string> {
  value: T;
  label: string;
  selected: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
}

export interface SegmentedControlProps<T extends string> {
  /** 整組的無障礙名稱（radiogroup）。 */
  label: string;
  options: readonly SegmentedControlOption<T>[];
  onSelect: (value: T) => void;
}
