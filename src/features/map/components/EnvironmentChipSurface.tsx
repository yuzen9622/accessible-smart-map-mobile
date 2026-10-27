import type { ReactElement } from 'react';
import { StyleSheet } from 'react-native';

import { SHAPE } from '@/shared/theme';
import GlassCard from '@/shared/ui/GlassCard';

export default function EnvironmentChipSurface({ children }: { children: ReactElement }) {
  return <GlassCard style={styles.capsule} interactive>{children}</GlassCard>;
}

const styles = StyleSheet.create({
  capsule: { borderRadius: SHAPE.pill },
});
