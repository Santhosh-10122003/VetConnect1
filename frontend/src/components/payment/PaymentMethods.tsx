import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { getPaymentGateway } from '../../utils/helpers';

const METHODS: { icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
  { icon: 'phone-portrait-outline', label: 'UPI' },
  { icon: 'card-outline', label: 'Cards' },
  { icon: 'business-outline', label: 'Net banking' },
  { icon: 'wallet-outline', label: 'Wallets' },
];

/** The ways the advance can be paid, shown wherever the customer is about to pay. */
export const PaymentMethods: React.FC = () => {
  const live = getPaymentGateway() === 'razorpay';
  return (
    <View style={styles.box} testID="payment-methods">
      <Text style={styles.title}>{live ? 'Pay securely with' : 'Payment (test mode)'}</Text>
      {live ? (
        <>
          <View style={styles.row}>
            {METHODS.map((m) => (
              <View key={m.label} style={styles.chip}>
                <Ionicons name={m.icon} size={16} color={colors.primary} />
                <Text style={styles.chipText}>{m.label}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.note}>You choose how to pay on Razorpay's secure page. Your card or bank details never reach VetConnect.</Text>
        </>
      ) : (
        <Text style={styles.note}>No real money is charged. You will see test Pay and Decline buttons on the next screen.</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  box: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: colors.border },
  title: { fontSize: 13, fontWeight: '800', color: colors.text, marginBottom: 10 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.mint, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7, borderWidth: 1, borderColor: colors.mintBorder },
  chipText: { fontSize: 12, fontWeight: '700', color: colors.primary },
  note: { fontSize: 12, color: colors.textSecondary, marginTop: 8, lineHeight: 17 },
});
