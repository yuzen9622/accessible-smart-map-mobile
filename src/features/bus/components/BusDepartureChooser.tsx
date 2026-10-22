import BusDepartureChooserBase from './BusDepartureChooserBase';
import type { BusDepartureChooserProps } from './BusDepartureChooser.types';

/** fallback（web／型別解析）：iOS 外觀，沒有觸覺回饋。 */
export default function BusDepartureChooser(props: BusDepartureChooserProps) {
  return <BusDepartureChooserBase {...props} variant="ios" onFeedback={() => {}} />;
}
