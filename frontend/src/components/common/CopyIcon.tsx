import React, { useEffect, useRef, useState } from 'react';
import { Text, TouchableOpacity } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { themedStyles } from '../../theme/themed';

/** A small copy button: tap it and the text goes to the clipboard; the icon turns into a tick for a moment. */
export const CopyIcon: React.FC<{ value: string; label?: string; testID?: string }> = ({ value, label = 'Copy', testID }) => {
  const [done, setDone] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = async () => {
    try {
      await Clipboard.setStringAsync(value);
      setDone(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setDone(false), 1600);
    } catch {
      setDone(false);
    }
  };

  return (
    <TouchableOpacity style={[styles.btn, done && styles.btnDone]} onPress={copy} activeOpacity={0.8} accessibilityLabel={`${label} ${value}`} testID={testID ?? 'copy-icon'}>
      <Ionicons name={done ? 'checkmark' : 'copy-outline'} size={16} color={done ? colors.successText : colors.primary} />
      <Text style={[styles.text, done && { color: colors.successText }]}>{done ? 'Copied' : label}</Text>
    </TouchableOpacity>
  );
};

const styles = themedStyles(() => ({
  btn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, backgroundColor: colors.mint },
  btnDone: { backgroundColor: colors.successBg },
  text: { fontSize: 12, fontWeight: '800', color: colors.ink },
}));
