import { Stack } from 'expo-router';

import { ExplorePanel } from '@/features/place';
export default function ExploreSheet() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ExplorePanel />
    </>
  );
}
