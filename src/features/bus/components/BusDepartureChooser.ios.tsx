import { haptic } from '@/shared/haptics';

import BusDepartureChooserBase from './BusDepartureChooserBase';
import type { BusDepartureChooserProps } from './BusDepartureChooser.types';

/** iOS：換班次給 selection 觸覺回饋（同系統 picker 撥動的手感），按下時卡片微縮。 */
export default function BusDepartureChooser(props: BusDepartureChooserProps) {
  return <BusDepartureChooserBase {...props} variant="ios" onFeedback={haptic.select} />;
}
