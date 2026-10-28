import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { shared } from '../../theme/shared';
import { careApi, CareBooking } from '../../api/careApi';
import { useAuth } from '../../context/AuthContext';
import { PayPanel } from '../../components/payment/PayPanel';
import { AppHeader } from '../../components/common/AppHeader';
import { AppButton } from '../../components/common/AppButton';
import { LoadingView } from '../../components/common/LoadingView';
import { careWhat, careWhen } from '../../components/care/BookingCard';
import { CustomerStackParamList } from '../../navigation/types';
import { confirmAction, getErrorMessage, money, notify } from '../../utils/helpers';

type Props = NativeStackScreenProps<CustomerStackParamList, 'CarePayment'>;
type Busy = 'pay' | 'fail' | 'retry' | 'cancel' | null;

const mmss = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

/** Pay the advance. The gateway is in test mode in this build, so a clearly marked test payment is offered. */
export const CarePaymentScreen: React.FC<Props> = ({ navigation, route }) => {
  const { bookingId } = route.params;
  const { user } = useAuth();
  const [booking, setBooking] = useState<CareBooking | null>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const [now, setNow] = useState(Date.now());

  const load = useCallback(() => {
    careApi.booking(bookingId).then(setBooking).catch((e) => notify('Error', getErrorMessage(e)));
  }, [bookingId]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  if (!booking) return <LoadingView />;

  const goCare = () => navigation.reset({ index: 0, routes: [{ name: 'CustomerTabs', params: { screen: 'PetCare' } }] });
  const left = booking.expiresAt ? new Date(booking.expiresAt).getTime() - now : 0;
  const awaiting = booking.status === 'AWAITING_PAYMENT' && left > 0;
  const payment = booking.payment;
  const failed = payment?.status === 'FAILED';

  const run = async (kind: Exclude<Busy, null>, fn: () => Promise<CareBooking | void>) => {
    setBusy(kind);
    try {
      const next = await fn();
      if (next) setBooking(next);
    } catch (e) {
      notify('Payment problem', getErrorMessage(e));
      load();
    } finally {
      setBusy(null);
    }
  };

  const cancelHold = async () => {
    if (!(await confirmAction('Cancel booking', 'Nothing has been charged. The held slot will be released.', 'Cancel booking', true))) return;
    await run('cancel', async () => { await careApi.cancel(booking.id); goCare(); });
  };

  if (booking.status === 'REQUESTED' || booking.status === 'CONFIRMED') {
    return (
      <View style={shared.screen}>
        <AppHeader title="Payment" />
        <ScrollView contentContainerStyle={shared.content}>
          <View style={[shared.card, styles.center]}>
            <Ionicons name="checkmark-circle" size={64} color={colors.success} />
            <Text style={styles.big} testID="pay-success">Request sent!</Text>
            <Text style={styles.sub}>
              We received your advance of {money(payment?.amount ?? booking.advanceAmount)}. {booking.providerName} will confirm your booking shortly.
            </Text>
            <Text style={styles.ref}>{booking.reference}</Text>
          </View>
          <View style={shared.card}>
            <Text style={styles.what}>{careWhat(booking)} for {booking.petName}</Text>
            <Text style={styles.sub}>{careWhen(booking)}</Text>
            <Text style={[styles.sub, { marginTop: 6 }]}>Pay the remaining {money(booking.balanceAmount)} at the visit.</Text>
          </View>
          <AppButton title="View booking" onPress={() => navigation.replace('CareBookingDetails', { bookingId: booking.id })} />
          <AppButton title="Back to Pet Care" variant="outline" style={{ marginTop: 10 }} onPress={goCare} />
        </ScrollView>
      </View>
    );
  }

  if (!awaiting) {
    const held = booking.status === 'AWAITING_PAYMENT' || booking.status === 'EXPIRED';
    return (
      <View style={shared.screen}>
        <AppHeader title="Payment" />
        <ScrollView contentContainerStyle={shared.content}>
          <View style={[shared.card, styles.center]}>
            <Ionicons name="time-outline" size={56} color={colors.warning} />
            <Text style={styles.big} testID="pay-ended">{held ? 'The hold has ended' : 'This booking is closed'}</Text>
            <Text style={styles.sub}>
              {held ? 'The slot was released because the advance was not paid in time. Nothing was charged. Please book again.' : 'There is nothing to pay for this booking.'}
            </Text>
          </View>
          <AppButton title="Back to Pet Care" onPress={goCare} />
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={shared.screen}>
      <AppHeader title="Pay the advance" showBack onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={shared.content}>
        <View style={styles.timer}>
          <Ionicons name="timer-outline" size={18} color={colors.warning} />
          <Text style={styles.timerText}>Your slot is held for <Text style={{ fontWeight: '800' }} testID="hold-timer">{mmss(left)}</Text></Text>
        </View>

        <View style={shared.card}>
          <Text style={styles.what}>{careWhat(booking)} for {booking.petName}</Text>
          <Text style={styles.sub}>{booking.providerName}</Text>
          <Text style={styles.sub}>{careWhen(booking)}</Text>
          <View style={styles.lines}>
            {booking.items.map((i, idx) => (
              <View key={`${i.name}-${idx}`} style={shared.rowBetween}><Text style={styles.sub}>{i.name}</Text><Text style={styles.val}>{money(i.price)}</Text></View>
            ))}
            <View style={[shared.rowBetween, styles.totalRow]}><Text style={styles.val}>Total</Text><Text style={styles.val}>{money(booking.totalAmount)}</Text></View>
            <View style={shared.rowBetween}><Text style={styles.sub}>Pay at the visit</Text><Text style={styles.val}>{money(booking.balanceAmount)}</Text></View>
          </View>
        </View>

        <View style={styles.due}>
          <Text style={styles.dueLabel}>Due now</Text>
          <Text style={styles.dueValue} testID="due-now">{money(booking.advanceAmount)}</Text>
        </View>

        <PayPanel
          payment={payment}
          amount={booking.advanceAmount}
          description={`Advance for ${booking.reference}`}
          prefill={{ name: user?.fullName, email: user?.email }}
          busy={busy === 'pay' || busy === 'fail' || busy === 'retry' ? busy : null}
          onTest={(o) => run(o === 'SUCCESS' ? 'pay' : 'fail', () => careApi.pay(booking.id, o))}
          onRetry={() => run('retry', () => careApi.retryPayment(booking.id))}
          onCheckoutSuccess={(r) => run('pay', () => careApi.confirmPayment(booking.id, r))}
          onCheckoutFailed={(m) => run('retry', () => careApi.paymentFailed(booking.id, m))}
        />
        <AppButton title="Cancel booking" variant="outline" textStyle={{ color: colors.danger }} style={{ borderColor: colors.danger, marginTop: 10 }} onPress={cancelHold} loading={busy === 'cancel'} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  center: { alignItems: 'center' },
  big: { fontSize: 20, fontWeight: '800', color: colors.text, marginTop: 10, textAlign: 'center' },
  sub: { fontSize: 13, color: colors.textSecondary, marginTop: 4, lineHeight: 19 },
  ref: { fontSize: 12, fontWeight: '700', color: colors.textSecondary, marginTop: 10 },
  what: { fontSize: 16, fontWeight: '800', color: colors.text },
  lines: { marginTop: 12, gap: 6 },
  val: { fontSize: 13, fontWeight: '700', color: colors.text },
  totalRow: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8 },
  timer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#FFFBEB', borderRadius: 12, padding: 10, marginBottom: 14 },
  timerText: { fontSize: 13, color: colors.text },
  due: { backgroundColor: colors.primary, borderRadius: 16, padding: 18, marginBottom: 14, alignItems: 'center' },
  dueLabel: { color: '#DBEAFE', fontSize: 13, fontWeight: '700' },
  dueValue: { color: '#FFFFFF', fontSize: 32, fontWeight: '800' },
});
