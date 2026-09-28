import { router } from 'expo-router';
import { useEffect } from 'react';

import { MapScreen } from '@/features/map';
import { needsOnboarding, useOnboardingStore } from '@/features/onboarding';
import { PlacePinLayer } from '@/features/place';

export default function Index() {
  // MMKV 同步 hydrate，第一個 render 就能判斷，不會對回訪使用者閃一下引導
  const shouldOnboard = useOnboardingStore(needsOnboarding);
  useEffect(() => {
    if (shouldOnboard) router.push('/onboarding');
  }, [shouldOnboard]);

  return <MapScreen layers={<PlacePinLayer />} />;
}
