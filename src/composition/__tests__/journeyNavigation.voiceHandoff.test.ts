import { router } from 'expo-router';

import { useIndoorStore } from '@/features/indoor';
import { sheetNavigation } from '@/features/map';
import { beginNavigation } from '@/features/navigation';
import { getRouteSessionSnapshot } from '@/features/route/hooks/useRouteSession';
import { prepareIndoorVoiceNavigation } from '@/features/voice/controller/voiceNavigationBridge';

import { beginJourneyNavigation } from '../journeyNavigation';

jest.mock('expo-router', () => ({ router: { navigate: jest.fn() } }));
jest.mock('@/features/indoor', () => ({ useIndoorStore: { getState: () => ({ clearRoute: jest.fn() }) } }));
jest.mock('@/features/map', () => ({ sheetNavigation: { whenVisible: jest.fn((run: () => void) => run()) } }));
jest.mock('@/features/navigation', () => ({ beginNavigation: jest.fn() }));
jest.mock('@/features/route/hooks/useRouteSession', () => ({ getRouteSessionSnapshot: jest.fn(() => ({ indoorRoute: null })) }));
jest.mock('@/features/voice/controller/voiceNavigationBridge', () => ({ prepareIndoorVoiceNavigation: jest.fn() }));

it('uses the existing handoff route without starting the outdoor lifecycle or another voice session', () => {
  const clear = jest.spyOn(useIndoorStore, 'getState');
  beginJourneyNavigation({ notificationTitle: 'title', notificationBody: 'body' }, 'handoff');
  expect(sheetNavigation.whenVisible).toHaveBeenCalledTimes(1);
  expect(router.navigate).toHaveBeenCalledWith({ pathname: '/navigation', params: { indoor: 'handoff' } });
  expect(beginNavigation).not.toHaveBeenCalled();
  expect(prepareIndoorVoiceNavigation).not.toHaveBeenCalled();
  expect(getRouteSessionSnapshot).not.toHaveBeenCalled();
  expect(clear).not.toHaveBeenCalled();
});
