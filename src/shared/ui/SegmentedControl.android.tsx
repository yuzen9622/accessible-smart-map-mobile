import SegmentedControlBase from './SegmentedControlBase';
import type { SegmentedControlProps } from './SegmentedControl.types';

export default function SegmentedControl<T extends string>(props: SegmentedControlProps<T>) {
  return <SegmentedControlBase {...props} variant="material" />;
}
