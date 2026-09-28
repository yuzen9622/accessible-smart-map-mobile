// Phase 0 共用層原生煙霧測試：MMKV persist、SecureStore、shared/ui、LocationPort。Phase 1 起刪除。
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { getLocationPort } from '@/shared/location';
import { createPersistStorage, getSecureItem, setSecureItem } from '@/shared/storage';
import { useThemeColors } from '@/shared/theme';
import { Button, EmptyState, ErrorState, LoadingState } from '@/shared/ui';

interface LaunchState {
  launches: number;
  bump: () => void;
}

const useLaunchStore = create<LaunchState>()(
  persist(
    (set) => ({ launches: 0, bump: () => set((state) => ({ launches: state.launches + 1 })) }),
    { name: 'spike.launches', storage: createPersistStorage<LaunchState>() },
  ),
);

export default function FoundationSpikeScreen() {
  const colors = useThemeColors();
  const launches = useLaunchStore((state) => state.launches);
  const bump = useLaunchStore((state) => state.bump);
  const [secure, setSecure] = useState('（未測）');
  const [location, setLocation] = useState('（未測）');

  useEffect(() => {
    bump();
  }, [bump]);

  const testSecure = async () => {
    try {
      const value = `token-${Date.now()}`;
      await setSecureItem('spike.token', value);
      const read = await getSecureItem('spike.token');
      setSecure(read === value ? `OK ${read}` : `不一致：${String(read)}`);
    } catch (error) {
      setSecure(`失敗：${String(error)}`);
    }
  };

  const testLocation = async () => {
    try {
      const port = getLocationPort();
      const status = await port.requestForegroundPermission();
      if (status !== 'granted') {
        setLocation(`權限：${status}`);
        return;
      }
      const position = await port.getCurrent({ accuracy: 'high' });
      setLocation(`${position.lat.toFixed(5)}, ${position.lng.toFixed(5)} ±${Math.round(position.accuracy ?? -1)} m`);
    } catch (error) {
      setLocation(`失敗：${String(error)}`);
    }
  };

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}>
      <Text style={[styles.line, { color: colors.text }]}>MMKV persist 開啟次數：{launches}</Text>
      <Text style={[styles.line, { color: colors.text }]}>SecureStore：{secure}</Text>
      <Text style={[styles.line, { color: colors.text }]}>定位：{location}</Text>
      <Button label="測試 SecureStore" onPress={() => void testSecure()} />
      <Button label="測試定位" variant="secondary" onPress={() => void testLocation()} />
      <View style={styles.block}>
        <EmptyState title="附近沒有設施" description="試著放大地圖範圍" systemImage="mappin.slash" />
      </View>
      <View style={styles.block}>
        <ErrorState
          title="載入失敗"
          description="請檢查網路連線"
          retry={{ label: '重試', onPress: () => setLocation('按了重試') }}
        />
      </View>
      <View style={styles.block}>
        <LoadingState label="載入中" />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 12 },
  line: { fontSize: 15 },
  block: { height: 220 },
});
