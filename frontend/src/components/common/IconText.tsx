import React from 'react';
import { View, Text, StyleSheet, StyleProp, TextStyle, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  size?: number;
  children: React.ReactNode;
  textStyle?: StyleProp<TextStyle>;
  style?: StyleProp<ViewStyle>;
  numberOfLines?: number;
}

/**
 * A small icon with a line of text beside it, centred on the same line. An icon placed inside a Text sits on the
 * text baseline and looks off-centre (and wraps badly), so icon + text rows use this instead.
 */
export const IconText: React.FC<Props> = ({ icon, iconColor, size = 13, children, textStyle, style, numberOfLines }) => (
  <View style={[styles.row, style]}>
    <Ionicons name={icon} size={size} color={iconColor} style={styles.icon} />
    <Text style={[styles.text, textStyle]} numberOfLines={numberOfLines}>{children}</Text>
  </View>
);

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', flexShrink: 1 },
  icon: { marginRight: 4 },
  text: { flexShrink: 1 },
});
