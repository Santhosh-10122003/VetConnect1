import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors } from '../../theme/colors';
import { AppInput } from './AppInput';
import { emailError, emailSuggestion } from '../../utils/validators';

interface Props {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  /** Show the error even if the field was never touched (e.g. after pressing the submit button). */
  forceError?: boolean;
  testID?: string;
}

/**
 * Email input with inline validation: it checks the format once the user leaves the field (then on every keystroke),
 * and offers a one-tap fix for typos such as "gmial.com".
 */
export const EmailField: React.FC<Props> = ({ value, onChange, label = 'Email Address *', forceError, testID }) => {
  const [touched, setTouched] = useState(false);
  const error = touched || forceError ? emailError(value) : null;
  const suggestion = !error && value ? emailSuggestion(value) : null;

  return (
    <View>
      <AppInput
        testID={testID}
        label={label}
        placeholder="name@example.com"
        value={value}
        onChangeText={(v) => onChange(v.replace(/\s/g, ''))}
        onBlur={() => setTouched(true)}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
        icon="mail-outline"
        error={error ?? undefined}
      />
      {suggestion ? (
        <TouchableOpacity style={styles.suggestion} onPress={() => onChange(suggestion)} accessibilityRole="button">
          <Text style={styles.suggestionText}>
            Did you mean <Text style={styles.suggestionBold}>{suggestion}</Text>? Tap to use it
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  suggestion: { marginTop: -8, marginBottom: 12, paddingVertical: 4 },
  suggestionText: { fontSize: 12, color: colors.textSecondary },
  suggestionBold: { fontWeight: '800', color: colors.primary },
});
