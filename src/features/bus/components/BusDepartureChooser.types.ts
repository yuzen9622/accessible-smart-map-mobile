import type { BusDepartureCandidate } from '@/features/route/domain';

export interface BusDepartureChooserProps {
  /** 後端排序好的候選班次（含導航採用的那班）。 */
  candidates: readonly BusDepartureCandidate[];
  /** 目前查看的班次；null 時以導航採用的那班為準。 */
  viewed: BusDepartureCandidate | null;
  /** 路線色（公車 leg 的顏色），選中框與路線徽章共用。 */
  legColor: string;
  /** 倒數用的目前時間（呼叫端以 `useNow` 每 30 秒更新）。 */
  now: number;
  onView: (candidate: BusDepartureCandidate) => void;
}
