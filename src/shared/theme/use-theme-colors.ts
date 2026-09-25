import { useColorScheme } from 'react-native';

import { Colors, type ThemeColors } from './colors';

export function useThemeColors(): ThemeColors {
  const scheme = useColorScheme();
  return scheme === 'dark' ? Colors.dark : Colors.light;
}
