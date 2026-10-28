import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import type { CarePayment } from '../../api/careApi';
import { AppButton } from '../common/AppButton';
import { PaymentMethods } from './PaymentMethods';
import { RazorpayCheckout, CheckoutSuccess } from './RazorpayCheckout';
import { money } from '../../utils/helpers';

type Busy = 'pay' | 'fail' | 'retry' | null;

interface Props {
  payment?: CarePayment | null;
  amount: number;
  description: string;
  prefill?: { name?: string; email?: string; contact?: string };
  /** True while a call to the server (confirming, retrying) is running. */
  busy: Busy;
  onTest: (outcome: 'SUCCESS' | 'FAILURE') => void;
  onRetry: () => void;
  onCheckoutSuccess: (result: CheckoutSuccess) => void;
  onCheckoutFailed: (message: string) => void;
}

/**
 * The "pay now" part of a payment screen. With Razorpay it opens the real checkout; with the built-in test gateway it
 * shows clearly marked test buttons. Used for both vet appointments and pet-care bookings.
 */
export const PayPanel: React.FC<Props> = ({ payment, amount, description, prefill, busy, onTest, onRetry, onCheckoutSuccess, onCheckoutFailed }) => {
  const [open, setOpen] = useState(false);
  const failed = payment?.status === 'FAILED';
  const checkout = !!payment?.keyId;

  return (
    <View>
      <PaymentMethods />
      {payment?.testMode && (
        <View style={styles.test}>
          <Ionicons name="flask-outline" size={18} color={colors.info} />
          <Text style={styles.testText}>
            {checkout
              ? 'Razorpay test mode: no real money is charged. Use the test card or UPI details shown on the payment page.'
              : 'Test mode: no real money is charged. Use the buttons below to try a payment.'}
          </Text>
        </View>
      )}

      {failed && <Text style={styles.failed} testID="pay-failed">{payment?.failureReason || 'The payment was declined.'} Your slot is still held. Try again.</Text>}

      {checkout ? (
        <AppButton title={failed ? 'Try again' : `Pay ${money(amount)} securely`} onPress={() => setOpen(true)} loading={busy === 'pay'} testID="pay-razorpay" />
      ) : failed ? (
        <AppButton title="Try again" onPress={onRetry} loading={busy === 'retry'} testID="pay-retry" />
      ) : (
        <>
          <AppButton title={`Pay ${money(amount)}${payment?.testMode ? ' (test)' : ''}`} onPress={() => onTest('SUCCESS')} loading={busy === 'pay'} testID="pay-now" />
          {payment?.testMode && (
            <AppButton title="Simulate a declined payment" variant="outline" style={{ marginTop: 10 }} onPress={() => onTest('FAILURE')} loading={busy === 'fail'} testID="pay-fail" />
          )}
        </>
      )}

      {open && payment && (
        <RazorpayCheckout
          payment={payment}
          description={description}
          prefill={prefill}
          onSuccess={(r) => { setOpen(false); onCheckoutSuccess(r); }}
          onFailure={(m) => { setOpen(false); onCheckoutFailed(m); }}
          onDismiss={() => setOpen(false)}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  test: { flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: colors.mint, borderRadius: 12, padding: 12, marginBottom: 14 },
  testText: { flex: 1, fontSize: 12, color: colors.text, lineHeight: 17 },
  failed: { color: colors.danger, fontSize: 13, marginBottom: 10, textAlign: 'center' },
});
