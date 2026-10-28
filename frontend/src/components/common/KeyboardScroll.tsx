import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, ScrollViewProps, StyleProp, ViewStyle } from 'react-native';

interface Props extends ScrollViewProps {
  /** Style for the wrapper that makes room for the keyboard (rarely needed). */
  wrapperStyle?: StyleProp<ViewStyle>;
}

/**
 * Wrapper for screens with text boxes: the screen shrinks when the keyboard opens so the box being typed in is never
 * covered, scrolls to it, and keeps taps working while the keyboard is up.
 */
export const KeyboardScroll: React.FC<Props> = ({ wrapperStyle, children, ...scrollProps }) => (
  <KeyboardAvoidingView style={[{ flex: 1 }, wrapperStyle]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <ScrollView
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      automaticallyAdjustKeyboardInsets
      {...scrollProps}
    >
      {children}
    </ScrollView>
  </KeyboardAvoidingView>
);

/** For list screens (FlatList) that contain text boxes: only makes room for the keyboard. */
export const KeyboardAvoid: React.FC<{ children: React.ReactNode; style?: StyleProp<ViewStyle> }> = ({ children, style }) => (
  <KeyboardAvoidingView style={[{ flex: 1 }, style]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    {children}
  </KeyboardAvoidingView>
);
