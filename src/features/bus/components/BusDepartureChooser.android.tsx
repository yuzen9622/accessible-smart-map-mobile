import { haptic } from '@/shared/haptics';

import BusDepartureChooserBase from './BusDepartureChooserBase';
import type { BusDepartureChooserProps } from './BusDepartureChooser.types';

/** Android：Material 水波紋＋segment tick 觸覺回饋。 */
export default function BusDepartureChooser(props: BusDepartureChooserProps) {
  return (
    <BusDepartureChooserBase
      {...props}
      variant="material"
      onFeedback={haptic.select}
    />
  );
}
