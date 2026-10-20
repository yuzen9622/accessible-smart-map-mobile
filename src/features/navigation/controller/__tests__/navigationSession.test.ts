import { router } from 'expo-router';

import { sheetNavigation } from '@/features/map';

import { beginNavigation, endNavigation } from '../navigationSession';

jest.mock('expo-router', () => ({ router: { navigate: jest.fn(), dismissTo: jest.fn() } }));
jest.mock('@/features/map', () => ({
  ...jest.requireActual('@/features/map/controller/sheetNavigation'),
  mapCamera: { stopFollow: () => {} },
}));
jest.mock('@/features/route', () => ({ fitSelectedRoute: () => {} }));
jest.mock('@/shared/location', () => ({ startBackgroundLocation: async () => {}, stopBackgroundLocation: async () => {} }));
jest.mock('@/shared/logger', () => ({ logger: { warn: () => {} } }));
jest.mock('../navigationLifecycle', () => ({ startNavigation: () => true, stopNavigation: () => {} }));

const texts = { notificationTitle: 'title', notificationBody: 'body' };

beforeEach(() => {
  jest.mocked(router.navigate).mockClear();
  jest.mocked(router.dismissTo).mockClear();
});

it('shows the navigation panel, then returns the sheet to the route results', () => {
  sheetNavigation.setVisible(true);
  beginNavigation(texts);
  endNavigation();

  expect(router.navigate).toHaveBeenCalledWith('/navigation');
  expect(router.dismissTo).toHaveBeenCalledWith('/routes');
});

it('keeps the home panel under the route results when voice starts and ends navigation behind a modal', () => {
  sheetNavigation.setVisible(false);
  beginNavigation(texts);
  endNavigation();
  expect(router.navigate).not.toHaveBeenCalled();

  sheetNavigation.setVisible(true);
  // The navigation panel was never shown, so dismissing to /routes would replace the sheet's root panel.
  expect(router.dismissTo).not.toHaveBeenCalled();
  expect(router.navigate).toHaveBeenCalledTimes(1);
  expect(router.navigate).toHaveBeenCalledWith('/routes');
});
