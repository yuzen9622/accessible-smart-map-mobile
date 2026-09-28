import type { SFSymbol } from 'expo-symbols';

export interface MapSpikeAction {
  key: string;
  label: string;
  systemImage: SFSymbol;
  onPress: () => void;
}

export interface MapSpikeControlsProps {
  actions: MapSpikeAction[];
}
