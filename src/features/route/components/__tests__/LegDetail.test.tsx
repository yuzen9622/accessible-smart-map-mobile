import { render, screen } from '@testing-library/react-native';

import type { MetroLeg } from '../../types/route';
import LegDetail from '../LegDetail';

jest.mock('@/shared/ui', () => {
  const { Text } = jest.requireActual('react-native');
  return { Icon: ({ name }: { name: string }) => <Text>{`icon:${name}`}</Text> };
});

const metro = (patch: Partial<MetroLeg> = {}): MetroLeg => ({
  type: 'METRO', railSystem: 'TRTC', lineId: 'BL', lineUid: 'TRTC_BL_BL-1_1', lineName: '板南線',
  departureStation: '市政府', arrivalStation: '台北車站', departureStationUid: 'TRTC_BL18', arrivalStationUid: 'TRTC_BL12',
  direction: 1, stopsCount: 6, rideMinutes: 10, waitInfo: { time: 0, source: 'schedule' }, estimatedWaitMinutes: 0,
  polyline: [], departureStationA11y: [], arrivalStationA11y: [], facilityHighlights: [], ...patch,
});

it('titles a metro leg with the line and the selected trip terminal, keeping the alighting station separate', async () => {
  await render(<LegDetail leg={metro({ terminalStation: '頂埔', terminalNameEn: 'Dingpu' })} />);
  expect(screen.getByRole('header')).toHaveTextContent('板南線 · toward Dingpu');
  expect(screen.getAllByText(/台北車站/).length).toBeGreaterThan(0);
});

it('shows only the line name when the trip terminal is unknown, never the alighting station', async () => {
  await render(<LegDetail leg={metro()} />);
  expect(screen.getByRole('header')).toHaveTextContent('板南線');
  expect(screen.getByRole('header')).not.toHaveTextContent('toward');
});

it('renders the line from its backend label in the UI language, not the source line name', async () => {
  await render(<LegDetail leg={metro({ lineKey: 'TRTC_R_R-3', lineName: '新北投支線', terminalStation: '北投', terminalNameEn: 'Beitou' })} />);
  expect(screen.getByRole('header')).toHaveTextContent('Xinbeitou Branch Line · toward Beitou');
});
