import type { RouteLanguage } from '../types/route';

export function venueHandoffCopy(language: RouteLanguage) {
  return language === 'en' ? {
    title: 'Indoor route', gate: 'Entrance', arrived: 'Arrived at the entrance',
    arrivalHint: 'Continue to your indoor destination.',
    confirm: 'At the entrance. Continue',
    description: 'Continue from the entrance.',
    distance: 'Remaining distance', duration: 'Estimated time', minutes: 'min',
    swapUnavailable: 'Indoor-to-outdoor journeys are not available yet.',
  } : {
    title: '室內接續路線', gate: '入口', arrived: '已抵達入口',
    arrivalHint: '繼續前往室內目的地。',
    confirm: '已到入口，繼續',
    description: '從入口接續前往目的地。',
    distance: '接續距離', duration: '預估時間', minutes: '分鐘',
    swapUnavailable: '目前尚未支援室內起點接往校外。',
  };
}
