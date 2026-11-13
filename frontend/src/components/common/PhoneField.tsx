import React, { useState } from 'react';
import { Text, TouchableOpacity } from 'react-native';
import { AppInput } from './AppInput';
import { normalizePhone, phoneError } from '../../utils/validators';
import { colors } from '../../theme/colors';

interface Props {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  /** Show the error even if the person has not left the field yet (after a failed submit). */
  forceError?: boolean;
  /** Older accounts can still sign in with the email they registered with: adds a "use email instead" switch. */
  allowEmail?: boolean;
  /** The field may stay empty (then `value` is ""). */
  optional?: boolean;
  /** Country code that is always there and cannot be edited or deleted. Default +91. */
  fixedCode?: string;
  /** Digits allowed after the code (10 for India). */
  maxDigits?: number;
  testID?: string;
}

const DEFAULT_CODE = '+91';

/**
 * A mobile number with its country code always in front (+91). The person types only the number; `value` still holds
 * the whole thing ("+91 9876543210"), so screens need no other changes. A number saved with another country code is
 * shown as it is and stays editable, so it is never altered by accident.
 */
export const PhoneField: React.FC<Props> = ({
  label = 'Mobile Number *', value, onChange, forceError, allowEmail, optional, fixedCode = DEFAULT_CODE, maxDigits = 10, testID,
}) => {
  const [touched, setTouched] = useState(false);
  const [emailMode, setEmailMode] = useState(!!allowEmail && value.includes('@'));
  const codeDigits = fixedCode.replace(/\D/g, '');
  const foreign = value.trim().startsWith('+') && !value.trim().startsWith(fixedCode);

  // "use email instead" (older accounts)
  if (allowEmail && emailMode) {
    return (
      <>
        <AppInput
          label="Email"
          placeholder="you@example.com"
          value={value}
          onChangeText={onChange}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          icon="mail-outline"
          testID={testID}
        />
        <Switch text="Use mobile number instead" onPress={() => { setEmailMode(false); onChange(''); }} />
      </>
    );
  }

  // a number saved with another country code: plain editable field, untouched
  if (foreign) {
    const problem = phoneError(value);
    return (
      <AppInput
        label={label}
        placeholder={`${fixedCode} 98765 43210`}
        value={value}
        onChangeText={(v) => onChange(v.replace(/[^0-9+\s().-]/g, ''))}
        onBlur={() => setTouched(true)}
        keyboardType="phone-pad"
        autoCorrect={false}
        icon="call-outline"
        error={(touched || forceError) && problem ? problem : undefined}
        testID={testID}
      />
    );
  }

  const typed = value.trim().startsWith(fixedCode) ? value.trim().slice(fixedCode.length) : value;
  const digits = typed.replace(/\D/g, '');
  const problem = digits.length === 0
    ? (optional ? null : 'Enter your mobile number')
    : phoneError(`${fixedCode}${digits}`);

  return (
    <>
      <AppInput
        label={label}
        prefix={fixedCode}
        placeholder="98765 43210"
        value={digits}
        onChangeText={(v) => {
          let d = v.replace(/\D/g, '');
          // a pasted "+91 98765 43210" or "0091 ..." keeps just the 10 digits; "098765 43210" drops its leading 0
          if (/^\s*(\+|00)/.test(v) && d.length > maxDigits && d.startsWith(codeDigits)) d = d.slice(codeDigits.length);
          else if (/^\s*00/.test(v) && d.startsWith('00' + codeDigits)) d = d.slice(2 + codeDigits.length);
          if (d.length > maxDigits && d.startsWith('0')) d = d.slice(1);
          d = d.slice(0, maxDigits);
          onChange(d.length === 0 && optional ? '' : `${fixedCode} ${d}`);
        }}
        onBlur={() => setTouched(true)}
        keyboardType="phone-pad"
        maxLength={24}
        autoCorrect={false}
        icon="call-outline"
        error={(touched || forceError) && problem ? problem : undefined}
        testID={testID}
      />
      {allowEmail && <Switch text="Use email instead (older accounts)" onPress={() => { setEmailMode(true); onChange(''); }} />}
    </>
  );
};

const Switch: React.FC<{ text: string; onPress: () => void }> = ({ text, onPress }) => (
  <TouchableOpacity onPress={onPress} style={{ alignSelf: 'flex-start', marginTop: -8, marginBottom: 14 }}>
    <Text style={{ fontSize: 13, fontWeight: '600', color: colors.primary }}>{text}</Text>
  </TouchableOpacity>
);

/** What to send to the server for whatever was typed. */
export const phoneForServer = (value: string): string => (value.includes('@') ? value.trim().toLowerCase() : normalizePhone(value));
