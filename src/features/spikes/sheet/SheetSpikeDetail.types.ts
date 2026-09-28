export interface SpikeLeg {
  key: string;
  mode: string;
  summary: string;
  stops: string[];
}

export const SPIKE_LEGS: SpikeLeg[] = [
  { key: 'walk-1', mode: '步行', summary: '步行 4 分鐘到台北車站 M8 出口電梯', stops: [] },
  { key: 'mrt', mode: '捷運淡水信義線', summary: '台北車站 → 台北101/世貿，4 站', stops: ['台大醫院', '中正紀念堂', '東門', '大安森林公園'] },
  { key: 'walk-2', mode: '步行', summary: '步行 3 分鐘到台北 101', stops: [] },
];

export interface SheetSpikeDetailProps {
  legs?: SpikeLeg[];
}
