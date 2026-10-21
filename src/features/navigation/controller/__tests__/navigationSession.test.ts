import { router } from 'expo-router';

import { sheetNavigation } from '@/features/map';
import { endRouteSession } from '@/features/route';

import { beginNavigation, endNavigation } from '../navigationSession';

jest.mock('expo-router', () => ({ router: { navigate: jest.fn(), dismissTo: jest.fn() } }));
jest.mock('@/features/map', () => ({
  ...jest.requireActual('@/features/map/controller/sheetNavigation'),
  mapCamera: { stopFollow: () => {} },
}));
jest.mock('@/features/route', () => ({ endRouteSession: jest.fn() }));
jest.mock('@/shared/location', () => ({ startBackgroundLocation: async () => {}, stopBackgroundLocation: async () => {} }));
jest.mock('@/shared/logger', () => ({ logger: { warn: () => {} } }));
jest.mock('../navigationLifecycle', () => ({ startNavigation: () => true, stopNavigation: () => {} }));

const texts = { notificationTitle: 'title', notificationBody: 'body' };

beforeEach(() => {
  jest.mocked(router.navigate).mockClear();
  jest.mocked(router.dismissTo).mockClear();
  jest.mocked(endRouteSession).mockClear();
});

it('shows the navigation panel, then clears the route session and returns home', () => {
  sheetNavigation.setVisible(true);
  beginNavigation(texts);
  endNavigation();

  expect(router.navigate).toHaveBeenCalledWith('/navigation');
  expect(endRouteSession).toHaveBeenCalledTimes(1);
  expect(router.dismissTo).toHaveBeenCalledWith('/explore');
});

it('clears the route immediately and returns home after the modal closes without reopening navigation', () => {
  sheetNavigation.setVisible(false);
  beginNavigation(texts);
  endNavigation();
  expect(endRouteSession).toHaveBeenCalledTimes(1);
  expect(router.navigate).not.toHaveBeenCalled();
  expect(router.dismissTo).not.toHaveBeenCalled();

  sheetNavigation.setVisible(true);
  expect(router.navigate).not.toHaveBeenCalled();
  expect(router.dismissTo).toHaveBeenCalledTimes(1);
  expect(router.dismissTo).toHaveBeenCalledWith('/explore');
});
