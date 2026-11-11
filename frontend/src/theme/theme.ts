import { MD3LightTheme, MD3DarkTheme } from 'react-native-paper';
import { colors, Scheme } from './colors';

/** The Paper theme for the colours currently in use. */
export const paperTheme = (scheme: Scheme) => {
  const base = scheme === 'dark' ? MD3DarkTheme : MD3LightTheme;
  return {
    ...base,
    colors: {
      ...base.colors,
      primary: colors.primary,
      primaryContainer: colors.mint,
      secondary: colors.primaryLight,
      secondaryContainer: colors.mintBorder,
      background: colors.background,
      surface: colors.card,
      surfaceVariant: colors.mint,
      onSurface: colors.text,
      error: colors.danger,
      outline: colors.border,
    },
    roundness: 14,
  };
};
