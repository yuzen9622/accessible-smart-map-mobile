import { Stack } from 'expo-router';

// Spike C：地圖上的常駐原生 sheet（formSheet + 低 detent 不變暗）。
export default function SpikesLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="map" />
      <Stack.Screen name="foundation" options={{ headerShown: true, title: 'Phase 0 共用層' }} />
      <Stack.Screen name="voice" options={{ headerShown: true, title: 'Spike B：語音' }} />
      <Stack.Screen
        name="sheet"
        options={{
          presentation: 'formSheet',
          sheetAllowedDetents: [0.25, 0.5, 1],
          sheetInitialDetentIndex: 0,
          sheetLargestUndimmedDetentIndex: 1,
          sheetGrabberVisible: true,
          gestureEnabled: false,
        }}
      />
    </Stack>
  );
}
