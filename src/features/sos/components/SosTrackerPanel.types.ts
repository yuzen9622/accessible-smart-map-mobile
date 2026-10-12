import type { SosTrackerModel } from '../hooks/useSosTracker';

export interface SosTrackerProgressStep {
  key: string;
  label: string;
  state: 'done' | 'current' | 'todo';
}

export interface SosTrackerPanelProps {
  model: SosTrackerModel;
}
