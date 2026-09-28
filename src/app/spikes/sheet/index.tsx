import { Stack, router } from 'expo-router';

import { SheetSpikePanel } from '@/features/spikes';

export default function SpikeSheetIndex() {
  return (
    <>
      <Stack.Screen options={{ title: '規劃路線' }} />
      <SheetSpikePanel onOpenDetail={() => router.push('/spikes/sheet/detail')} />
    </>
  );
}
