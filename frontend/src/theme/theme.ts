import { MD3LightTheme, configureFonts } from 'react-native-paper';
import { colors } from './colors';

export const theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: colors.primary,
    primaryContainer: colors.mint,
    secondary: colors.primaryLight,
    secondaryContainer: colors.mintBorder,
    background: colors.background,
    surface: colors.card,
    surfaceVariant: colors.mint,
    error: colors.danger,
    outline: colors.border,
  },
  roundness: 14,
};
