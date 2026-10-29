import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { shared } from '../../theme/shared';
import { AppInput } from '../common/AppInput';
interface HasPayout {
  payoutMethod?: 'UPI' | 'BANK' | null;
  upiId?: string | null;
  accountHolderName?: string | null;
  bankAccountMasked?: string | null;
  ifscCode?: string | null;
  bankName?: string | null;
}

export type PayoutMethod = 'UPI' | 'BANK';

export interface PayoutValues {
  method: PayoutMethod | null;
  upiId: string;
  holder: string;
  account: string;
  ifsc: string;
  bankName: string;
  /** The saved account number, masked (e.g. ********9012). Leaving the field empty keeps it. */
  savedAccountMasked?: string;
}

export const emptyPayout: PayoutValues = { method: null, upiId: '', holder: '', account: '', ifsc: '', bankName: '' };

export const payoutFromProvider = (p: HasPayout): PayoutValues => ({
  method: p.payoutMethod ?? null,
  upiId: p.upiId ?? '',
  holder: p.accountHolderName ?? '',
  account: '',
  ifsc: p.ifscCode ?? '',
  bankName: p.bankName ?? '',
  savedAccountMasked: p.bankAccountMasked ?? undefined,
});

const UPI = /^[A-Za-z0-9._-]{2,100}@[A-Za-z][A-Za-z0-9]{1,63}$/;
const IFSC = /^[A-Z]{4}0[A-Z0-9]{6}$/;

/** The same rules the server applies, so mistakes show up before sending. */
export const payoutErrors = (v: PayoutValues): Record<string, string> => {
  const e: Record<string, string> = {};
  if (!v.method) { e.method = 'Choose how you want to be paid'; return e; }
  if (v.method === 'UPI') {
    if (!UPI.test(v.upiId.trim())) e.upiId = 'Enter a valid UPI id, like name@bank';
    return e;
  }
  if (v.holder.trim().length < 2) e.holder = "Enter the account holder's name";
  const acc = v.account.replace(/\s/g, '');
  if (!(acc === '' && v.savedAccountMasked) && !/^[0-9]{9,18}$/.test(acc)) e.account = 'Enter a valid account number (9 to 18 digits)';
  if (!IFSC.test(v.ifsc.replace(/\s/g, '').toUpperCase())) e.ifsc = 'Enter a valid IFSC code, like HDFC0001234';
  return e;
};

export const payoutPayload = (v: PayoutValues) =>
  v.method === null
    ? {}
    : v.method === 'UPI'
    ? { payoutMethod: 'UPI' as const, upiId: v.upiId.trim() }
    : {
        payoutMethod: 'BANK' as const,
        accountHolderName: v.holder.trim(),
        bankAccountNumber: v.account.replace(/\s/g, ''),
        ifscCode: v.ifsc.replace(/\s/g, '').toUpperCase(),
        bankName: v.bankName.trim() || undefined,
      };

interface Props {
  value: PayoutValues;
  onChange: (v: PayoutValues) => void;
  /** Show the errors (after the first try to submit). */
  showErrors?: boolean;
}

/** Where the business gets paid: a UPI id, or a bank account. Required for every business and clinic offering pet care. */
export const PayoutFields: React.FC<Props> = ({ value, onChange, showErrors }) => {
  const errors = payoutErrors(value);
  const err = (k: string) => (showErrors ? errors[k] : undefined);
  const set = (patch: Partial<PayoutValues>) => onChange({ ...value, ...patch });

  return (
    <View style={styles.box} testID="payout-fields">
      <View style={styles.head}>
        <Ionicons name="wallet-outline" size={20} color={colors.primary} />
        <Text style={styles.title}>Payment details *</Text>
      </View>
      <Text style={styles.help}>Where should the advance payments from pet owners be paid out to you? This is required to take pet-care bookings. Only you and the admin can see it.</Text>

      <View style={shared.chipRow}>
        {(['UPI', 'BANK'] as const).map((m) => (
          <TouchableOpacity key={m} testID={`payout-${m}`} style={[shared.chip, value.method === m && shared.chipActive]} onPress={() => set({ method: m })}>
            <Text style={[shared.chipText, value.method === m && shared.chipTextActive]}>{m === 'UPI' ? 'UPI' : 'Bank account'}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {err('method') ? <Text style={styles.error}>{err('method')}</Text> : null}

      {value.method === 'UPI' && (
        <AppInput label="UPI id *" placeholder="name@bank" autoCapitalize="none" value={value.upiId} onChangeText={(v) => set({ upiId: v })} error={err('upiId')} icon="phone-portrait-outline" testID="payout-upi" />
      )}
      {value.method === 'BANK' && (
        <>
          <AppInput label="Account holder name *" value={value.holder} onChangeText={(v) => set({ holder: v })} error={err('holder')} icon="person-outline" />
          <AppInput
            label="Account number *"
            placeholder={value.savedAccountMasked ? `Saved: ${value.savedAccountMasked} (leave empty to keep)` : '9 to 18 digits'}
            keyboardType="number-pad"
            value={value.account}
            onChangeText={(v) => set({ account: v })}
            error={err('account')}
            icon="card-outline"
          />
          <AppInput label="IFSC code *" placeholder="e.g. HDFC0001234" autoCapitalize="characters" value={value.ifsc} onChangeText={(v) => set({ ifsc: v })} error={err('ifsc')} icon="business-outline" />
          <AppInput label="Bank name" value={value.bankName} onChangeText={(v) => set({ bankName: v })} icon="home-outline" />
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  box: { backgroundColor: colors.mint, borderRadius: 16, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: colors.mintBorder },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 15, fontWeight: '800', color: colors.text },
  help: { fontSize: 12, color: colors.textSecondary, marginTop: 6, marginBottom: 12, lineHeight: 17 },
  error: { color: colors.danger, fontSize: 12, marginTop: -8, marginBottom: 10 },
});
