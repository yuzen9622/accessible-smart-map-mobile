export const Colors = {
  light: {
    text: '#000000',
    textSecondary: '#60646C',
    background: '#FFFFFF',
    backgroundElement: '#F0F0F3',
  },
  dark: {
    text: '#FFFFFF',
    textSecondary: '#B0B4BA',
    background: '#000000',
    backgroundElement: '#212225',
  },
} as const;

export type ColorSchemeName = keyof typeof Colors;
export type ThemeColors = (typeof Colors)[ColorSchemeName];
