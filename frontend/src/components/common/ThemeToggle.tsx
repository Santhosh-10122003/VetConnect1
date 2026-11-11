import React from 'react';
import { TouchableOpacity, StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { useAppTheme } from '../../theme/ThemeProvider';

/** One tap to flip between the light and dark look. */
export const ThemeToggle: React.FC<{ style?: StyleProp<ViewStyle> }> = ({ style }) => {
  const { scheme, setChoice } = useAppTheme();
  const dark = scheme === 'dark';
  return (
    <TouchableOpacity
      style={style}
      onPress={() => setChoice(dark ? 'light' : 'dark')}
      activeOpacity={0.85}
      accessibilityLabel={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      testID="theme-toggle"
    >
      <Ionicons name={dark ? 'sunny' : 'moon'} size={22} color={colors.text} />
    </TouchableOpacity>
  );
};
