import { render, screen, within } from '@testing-library/react-native';

import type { AccessibleRoute } from '../../types/route';
import RouteCard from '../RouteCard';

jest.mock('../../controller/routeSessionPort', () => ({ canNavigateRoute: () => true }));
jest.mock('@/shared/ui', () => {
  const { Text } = jest.requireActual('react-native');
  return { Icon: ({ name, color }: { name: string; color: string }) => <Text style={{ color }}>{`icon:${name}`}</Text> };
});

const makeRoute = (): AccessibleRoute => ({
  routeId: 'r', routeName: 'Route', routeToken: 'token', totalMinutes: 10, transferCount: 0, legs: [],
  accessibilityHighlights: ['A toilet nearby', 'Source note', 'Other note', 'No walking connector available'],
  accessibilityHighlightDetails: [
    { index: 0, code: 'ROUTE_TOILET_AVAILABLE', message: 'A toilet nearby' },
    { index: 3, code: 'ROUTE_WALK_CONNECTOR_UNAVAILABLE', message: 'No walking connector available' },
  ],
  warnings: ['Source warning', 'Source warning'],
});

const renderCard = (route: AccessibleRoute) => render(
  <RouteCard route={route} selected onSelect={() => {}} onOpenDetail={() => {}} onStartNavigation={() => {}} />,
);

it('renders a late-index English warning with alert, not green check, before truncation', async () => {
  await renderCard(makeRoute());
  const row = screen.getByText('No walking connector available').parent!;
  expect(within(row).getByText('icon:alert')).toBeTruthy();
  expect(within(row).queryByText('icon:check')).toBeNull();
  expect(screen.getByText('A toilet nearby')).toBeTruthy();
  expect(screen.getByText('Source note')).toBeTruthy();
  expect(screen.queryByText('Other note')).toBeNull();
  expect(screen.getAllByText('Source warning')).toHaveLength(2);
});

it('uses a neutral icon for legacy, unknown-code and mismatched details without losing text', async () => {
  const route = makeRoute();
  route.accessibilityHighlights = ['請留意舊警示', 'Unknown warning', 'Wrong metadata'];
  route.accessibilityHighlightDetails = [
    { index: 1, code: 'NEW_WARNING', message: 'Unknown warning' },
    { index: 2, code: 'ROUTE_TOILET_AVAILABLE', message: 'different' },
  ];
  await renderCard(route);
  for (const text of route.accessibilityHighlights) {
    const row = screen.getByText(text).parent!;
    expect(within(row).getByText('icon:info')).toBeTruthy();
    expect(within(row).queryByText('icon:check')).toBeNull();
  }
});
