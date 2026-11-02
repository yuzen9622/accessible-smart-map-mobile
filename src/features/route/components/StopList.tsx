import { View } from 'react-native';

import { StopRow } from './StopList.shared';
import type { StopListProps } from './StopList.types';

/** Fallback（web／型別解析）：只列出停靠點，排序靠 VoiceOver 動作。 */
export default function StopList({ stops, labels }: StopListProps) {
  return <View>{stops.map((stop) => <StopRow key={stop.key} stop={stop} labels={labels} />)}</View>;
}
