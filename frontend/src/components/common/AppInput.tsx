import React, { useState } from 'react';
import {
  View,
  TextInput,
  Text,
  TouchableOpacity,
  TextInputProps,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { themedStyles } from '../../theme/themed';
import { InputKind, cleanInput, inputCapitalize, inputError, inputKeyboard, inputMaxLength, stripEmoji, hasEmoji } from '../../utils/inputRules';

interface AppInputProps extends TextInputProps {
  label?: string;
  error?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  isPassword?: boolean;
  /** What the field holds: filters what can be typed (no emoji, only the characters that belong) and checks it on leaving. */
  kind?: InputKind;
}

export const AppInput: React.FC<AppInputProps> = ({
  label,
  error,
  icon,
  isPassword = false,
  kind,
  style,
  onChangeText,
  onBlur,
  ...rest
}) => {
  const [showPassword, setShowPassword] = useState(!isPassword);
  const [isFocused, setIsFocused] = useState(false);
  const [leftBad, setLeftBad] = useState<string | null>(null);

  // every field refuses emoji; a kind adds its own rules
  const clean = (t: string) => (kind ? cleanInput(kind, t) : stripEmoji(t));
  const shownError = error || leftBad || null;

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View
        style={[
          styles.inputContainer,
          rest.multiline && styles.multilineContainer,
          isFocused && styles.focused,
          shownError ? styles.errorBorder : null,
        ]}
      >
        {icon && (
          <Ionicons
            name={icon}
            size={20}
            color={isFocused ? colors.primary : colors.textMuted}
            style={styles.icon}
          />
        )}
        <TextInput
          style={[styles.input, rest.multiline && styles.multilineInput, style]}
          placeholderTextColor={colors.textMuted}
          secureTextEntry={isPassword && !showPassword}
          keyboardType={kind ? inputKeyboard(kind) : undefined}
          autoCapitalize={kind ? inputCapitalize(kind) : undefined}
          maxLength={kind ? inputMaxLength(kind) : undefined}
          {...rest}
          onChangeText={onChangeText ? (t) => { const c = clean(t); if (leftBad) setLeftBad(null); onChangeText(c); } : undefined}
          onFocus={() => setIsFocused(true)}
          onBlur={(e) => {
            setIsFocused(false);
            const v = typeof rest.value === 'string' ? rest.value : '';
            setLeftBad(kind ? inputError(kind, v) : v && hasEmoji(v) ? 'Emoji and special symbols are not allowed' : null);
            onBlur?.(e);
          }}
        />
        {isPassword && (
          <TouchableOpacity
            onPress={() => setShowPassword(!showPassword)}
            style={styles.eyeButton}
          >
            <Ionicons
              name={showPassword ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={colors.textMuted}
            />
          </TouchableOpacity>
        )}
      </View>
      {!!shownError && <Text style={styles.errorText}>{shownError}</Text>}
    </View>
  );
};

const styles = themedStyles(() => ({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 6,
  },
  inputContainer: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
  },
  multilineContainer: {
    height: 'auto',
    minHeight: 52,
    alignItems: 'flex-start',
    paddingVertical: 4,
  },
  multilineInput: {
    height: 'auto',
    minHeight: 80,
    paddingTop: 10,
    paddingBottom: 10,
    textAlignVertical: 'top',
  },
  focused: {
    borderColor: colors.primary,
    backgroundColor: colors.card,
  },
  errorBorder: {
    borderColor: colors.danger,
  },
  icon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: 15,
    color: colors.text,
    paddingVertical: 0,
    // the frame already shows focus; the browser's own black outline would draw a second box inside it
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : {}),
  },
  eyeButton: {
    padding: 6,
  },
  errorText: {
    fontSize: 12,
    color: colors.danger,
    marginTop: 4,
    marginLeft: 4,
  },
}));
