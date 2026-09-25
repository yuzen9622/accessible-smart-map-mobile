import type { SFSymbol } from 'sf-symbols-typescript';

export interface MapSpikeAction {
  key: string;
  label: string;
  systemImage: SFSymbol;
  onPress: () => void;
}

export interface MapSpikeControlsProps {
  actions: MapSpikeAction[];
}
