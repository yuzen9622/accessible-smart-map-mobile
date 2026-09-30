import SegmentedControlBase from './SegmentedControlBase';
import type { SegmentedControlProps } from './SegmentedControl.types';

/** fallback（web／型別解析）：與 iOS 相同外觀。 */
export default function SegmentedControl<T extends string>(props: SegmentedControlProps<T>) {
  return <SegmentedControlBase {...props} variant="ios" />;
}
