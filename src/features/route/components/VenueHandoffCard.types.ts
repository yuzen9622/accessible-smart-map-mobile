import type { VenueHandoff } from '../types/route';

export interface VenueHandoffCardProps {
  handoff: VenueHandoff;
  onContinue?: () => void;
}
