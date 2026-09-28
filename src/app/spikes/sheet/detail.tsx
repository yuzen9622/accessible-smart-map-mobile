import { Stack } from 'expo-router';

import { SheetSpikeDetail } from '@/features/spikes';

export default function SpikeSheetDetail() {
  return (
    <>
      <Stack.Screen options={{ title: '路線詳情' }} />
      <SheetSpikeDetail />
    </>
  );
}
