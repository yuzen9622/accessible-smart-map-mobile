export type TravelMode = 'walk' | 'transit' | 'drive';

export const TRAVEL_MODES: { value: TravelMode; label: string }[] = [
  { value: 'walk', label: '步行' },
  { value: 'transit', label: '大眾運輸' },
  { value: 'drive', label: '開車' },
];

export interface SheetSpikePanelProps {
  onOpenDetail: () => void;
}
