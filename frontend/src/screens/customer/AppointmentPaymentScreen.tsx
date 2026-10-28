import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { shared } from '../../theme/shared';
import { appointmentApi, Appointment } from '../../api/appointmentApi';
import { useAuth } from '../../context/AuthContext';
import { AppHeader } from '../../components/common/AppHeader';
import { AppButton } from '../../components/common/AppButton';
import { LoadingView } from '../../components/common/LoadingView';
import { PayPanel } from '../../components/payment/PayPanel';
import { CustomerStackParamList } from '../../navigation/types';
import { confirmAction, drName, getErrorMessage, hhmm, money, notify } from '../../utils/helpers';

type Props = NativeStackScreenProps<CustomerStackParamList, 'AppointmentPayment'>;
type Busy = 'pay' | 'fail' | 'retry' | 'cancel' | null;

const mmss = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

/** Pay the advance (half the consultation fee) to confirm a vet appointment request. */
export const AppointmentPaymentScreen: React.FC<Props> = ({ navigation, route }) => {
  const { appointmentId } = route.params;
  const { user } = useAuth();
  const [appt, setAppt] = useState<Appointment | null>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const [now, setNow] = useState(Date.now());

  const load = useCallback(() => {
    appointmentApi.getAppointmentById(appointmentId).then((r) => setAppt(r.data)).catch((e) => notify('Error', getErrorMessage(e)));
  }, [appointmentId]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Once paid, the booking summary takes over.
  useEffect(() => {
    if (appt && (appt.status === 'PENDING' || appt.status === 'CONFIRMED')) {
      navigation.replace('BookingSummary', { appointmentId: appt.id });
    }
  }, [appt, navigation]);

  if (!appt) return <LoadingView />;

  const goHome = () => navigation.reset({ index: 0, routes: [{ name: 'CustomerTabs', params: { screen: 'Appointments', params: { initialTab: 'UPCOMING' } } }] });
  const left = appt.expiresAt ? new Date(appt.expiresAt).getTime() - now : 0;
  const awaiting = appt.status === 'AWAITING_PAYMENT' && left > 0;

  const run = async (kind: Exclude<Busy, null>, fn: () => Promise<Appointment | void>) => {
    setBusy(kind);
    try {
      const next = await fn();
      if (next) setAppt(next);
    } catch (e) {
      notify('Payment problem', getErrorMessage(e));
      load();
    } finally {
      setBusy(null);
    }
  };

  const cancelHold = async () => {
    if (!(await confirmAction('Cancel booking', 'Nothing has been charged. The held slot will be released.', 'Cancel booking', true))) return;
    await run('cancel', async () => { await appointmentApi.cancelAppointment(appt.id, 'Cancelled before paying'); goHome(); });
  };

  if (!awaiting) {
    return (
      <View style={shared.screen}>
        <AppHeader title="Payment" />
        <ScrollView contentContainerStyle={shared.content}>
          <View style={[shared.card, styles.center]}>
            <Ionicons name="time-outline" size={56} color={colors.warning} />
            <Text style={styles.big} testID="pay-ended">The hold has ended</Text>
            <Text style={styles.sub}>The slot was released because the advance was not paid in time. Nothing was charged. Please book again.</Text>
          </View>
          <AppButton title="Back to my appointments" onPress={goHome} />
        </ScrollView>
      </View>
    );
  }

  const payment = appt.payment;
  return (
    <View style={shared.screen}>
      <AppHeader title="Pay the advance" showBack onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={shared.content}>
        <View style={styles.timer}>
          <Ionicons name="timer-outline" size={18} color={colors.warning} />
          <Text style={styles.timerText}>Your slot is held for <Text style={{ fontWeight: '800' }} testID="hold-timer">{mmss(left)}</Text></Text>
        </View>

        <View style={shared.card}>
          <Text style={styles.what}>Consultation with {drName(appt.doctorName)}</Text>
          <Text style={styles.sub}>{appt.clinicName}</Text>
          <Text style={styles.sub}>{appt.appointmentDate} · {hhmm(appt.startTime)} - {hhmm(appt.endTime)} · {appt.petName}</Text>
          <View style={styles.lines}>
            <View style={shared.rowBetween}><Text style={styles.sub}>Consultation fee</Text><Text style={styles.val}>{money(appt.totalAmount)}</Text></View>
            <View style={[shared.rowBetween, styles.totalRow]}><Text style={styles.val}>Advance now</Text><Text style={styles.val}>{money(appt.advanceAmount)}</Text></View>
            <View style={shared.rowBetween}><Text style={styles.sub}>Pay at the clinic</Text><Text style={styles.val}>{money(appt.balanceAmount)}</Text></View>
          </View>
        </View>

        <View style={styles.due}>
          <Text style={styles.dueLabel}>Due now</Text>
          <Text style={styles.dueValue} testID="due-now">{money(appt.advanceAmount)}</Text>
        </View>

        <PayPanel
          payment={payment}
          amount={appt.advanceAmount}
          description={`Advance for appointment ${appt.bookingReference}`}
          prefill={{ name: user?.fullName, email: user?.email }}
          busy={busy === 'pay' || busy === 'fail' || busy === 'retry' ? busy : null}
          onTest={(o) => run(o === 'SUCCESS' ? 'pay' : 'fail', () => appointmentApi.simulatePayment(appt.id, o))}
          onRetry={() => run('retry', () => appointmentApi.retryPayment(appt.id))}
          onCheckoutSuccess={(r) => run('pay', () => appointmentApi.confirmPayment(appt.id, r))}
          onCheckoutFailed={(m) => run('retry', () => appointmentApi.paymentFailed(appt.id, m))}
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
  what: { fontSize: 16, fontWeight: '800', color: colors.text },
  lines: { marginTop: 12, gap: 6 },
  val: { fontSize: 13, fontWeight: '700', color: colors.text },
  totalRow: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8 },
  timer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#FFFBEB', borderRadius: 12, padding: 10, marginBottom: 14 },
  timerText: { fontSize: 13, color: colors.text },
  due: { backgroundColor: colors.primary, borderRadius: 16, padding: 18, marginBottom: 14, alignItems: 'center' },
  dueLabel: { color: colors.mintDark, fontSize: 13, fontWeight: '700' },
  dueValue: { color: '#FFFFFF', fontSize: 32, fontWeight: '800' },
});
