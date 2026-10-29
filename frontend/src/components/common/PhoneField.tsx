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
  testID?: string;
}

/** A mobile number with its country code. Starts with the default code so people only type the rest. */
export const PhoneField: React.FC<Props> = ({ label = 'Mobile Number *', value, onChange, forceError, allowEmail, testID }) => {
  const [touched, setTouched] = useState(false);
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
