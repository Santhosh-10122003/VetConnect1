import React, { useState } from 'react';
import { AppInput } from './AppInput';
import { normalizePhone, phoneError } from '../../utils/validators';

interface Props {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  /** Show the error even if the person has not left the field yet (after a failed submit). */
  forceError?: boolean;
  /** Older accounts can still sign in with the email they registered with. */
  allowEmail?: boolean;
  /**
   * A country code that is always there and cannot be edited or deleted (like "+91"). The person types only the
   * number; `value` still holds the whole thing ("+91 9876543210"), so callers need no changes.
   */
  fixedCode?: string;
  /** Digits allowed after a fixed code (10 for India). */
  maxDigits?: number;
  testID?: string;
}

/** A mobile number with its country code. Starts with the default code so people only type the rest. */
export const PhoneField: React.FC<Props> = ({ label = 'Mobile Number *', value, onChange, forceError, allowEmail, fixedCode, maxDigits = 10, testID }) => {
  const [touched, setTouched] = useState(false);

  if (fixedCode) {
    const codeDigits = fixedCode.replace(/\D/g, '');
    const typed = value.startsWith(fixedCode) ? value.slice(fixedCode.length) : value;
    const digits = typed.replace(/\D/g, '');
    const problem = digits.length === 0 ? 'Enter your mobile number' : phoneError(`${fixedCode}${digits}`);
    return (
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
          onChange(`${fixedCode} ${d.slice(0, maxDigits)}`);
        }}
        onBlur={() => setTouched(true)}
        keyboardType="phone-pad"
        maxLength={24}
        autoCorrect={false}
        icon="call-outline"
        error={(touched || forceError) && problem ? problem : undefined}
        testID={testID}
      />
    );
  }

  const isEmail = !!allowEmail && value.includes('@');
  const problem = isEmail ? null : phoneError(value);
  return (
    <AppInput
      label={label}
      placeholder={allowEmail ? '+91 98765 43210' : '+91 98765 43210'}
      value={value}
      onChangeText={(v) => onChange(isEmail || v.includes('@') ? v : v.replace(/[^0-9+\s().-]/g, ''))}
      onBlur={() => setTouched(true)}
      keyboardType={allowEmail ? 'default' : 'phone-pad'}
      autoCapitalize="none"
      autoCorrect={false}
      icon="call-outline"
      error={(touched || forceError) && problem ? problem : undefined}
      testID={testID}
    />
  );
};

/** What to send to the server for whatever was typed. */
export const phoneForServer = (value: string): string => (value.includes('@') ? value.trim().toLowerCase() : normalizePhone(value));
