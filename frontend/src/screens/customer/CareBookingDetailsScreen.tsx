import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { colors } from '../../theme/colors';
import { shared } from '../../theme/shared';
import { careApi, CareBooking } from '../../api/careApi';
import { AppHeader } from '../../components/common/AppHeader';
import { AppButton } from '../../components/common/AppButton';
import { LoadingView } from '../../components/common/LoadingView';
import { StatusBadge } from '../../components/common/StatusBadge';
import { ClinicLocationCard } from '../../components/common/ClinicLocationCard';
import { careWhat, careWhen } from '../../components/care/BookingCard';
import { CustomerStackParamList } from '../../navigation/types';
import { confirmAction, getErrorMessage, money, notify } from '../../utils/helpers';

type Props = NativeStackScreenProps<CustomerStackParamList, 'CareBookingDetails'>;

const Row: React.FC<{ k: string; v: string; bold?: boolean }> = ({ k, v, bold }) => (
  <View style={[shared.rowBetween, { marginTop: 6 }]}>
    <Text style={styles.k}>{k}</Text>
    <Text style={[styles.v, bold && { fontWeight: '800' }]}>{v}</Text>
  </View>
);

export const CareBookingDetailsScreen: React.FC<Props> = ({ navigation, route }) => {
  const { bookingId } = route.params;
  const [b, setB] = useState<CareBooking | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(() => {
    careApi.booking(bookingId).then(setB).catch((e) => {
      notify('Error', getErrorMessage(e));
      navigation.goBack();
    });
  }, [bookingId, navigation]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!b) return <LoadingView />;

  const cancellable = b.status === 'REQUESTED' || b.status === 'CONFIRMED';
  const payment = b.payment;

  const cancel = async () => {
    setCancelling(true);
    try {
      const preview = await careApi.cancellationPreview(b.id);
      if (!(await confirmAction('Cancel this booking?', preview.message, 'Cancel booking', true))) return;
      setB(await careApi.cancel(b.id, 'Cancelled by customer'));
      notify('Booking cancelled', preview.refundable ? `Your refund of ${money(preview.refundAmount)} is on its way.` : 'The advance is not refundable at this time.');
    } catch (e) {
      notify('Could not cancel', getErrorMessage(e));
    } finally {
      setCancelling(false);
    }
  };

  return (
    <View style={shared.screen}>
      <AppHeader title="Booking details" subtitle={b.reference} showBack onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={shared.content}>
        <View style={shared.card}>
          <View style={shared.rowBetween}>
            <Text style={styles.title}>{careWhat(b)}</Text>
            <StatusBadge status={b.status} />
          </View>
          <Text style={styles.sub}>{b.providerName}</Text>
          <Row k="Pet" v={`${b.petName} (${b.petSize.charAt(0) + b.petSize.slice(1).toLowerCase()})`} />
          <Row k="When" v={careWhen(b)} />
          {!!b.notes && <Row k="Notes" v={b.notes} />}
          {!!b.cancellationReason && <Row k="Cancelled" v={`${b.cancellationReason}${b.cancelledBy ? ` (${b.cancelledBy.toLowerCase()})` : ''}`} />}
        </View>

        <View style={shared.card}>
          <Text style={shared.sectionTitle}>Payment</Text>
          {b.items.map((i, idx) => <Row key={`${i.name}-${idx}`} k={i.name} v={money(i.price)} />)}
          <View style={styles.sep} />
          <Row k="Total" v={money(b.totalAmount)} bold />
          <Row k="Advance" v={`${money(b.advanceAmount)}${payment?.status === 'PAID' || payment?.status === 'REFUNDED' || payment?.status === 'PARTIALLY_REFUNDED' ? ' (paid)' : ''}`} />
          <Row k="Balance at the visit" v={money(b.balanceAmount)} />
          {!!payment && payment.refundedAmount > 0 && <Row k="Refunded" v={money(payment.refundedAmount)} bold />}
          {payment?.testMode && <Text style={styles.test}>Test payment, no real money moved.</Text>}
        </View>

        <View style={shared.card}>
          <Text style={shared.sectionTitle}>Where</Text>
          <ClinicLocationCard
            clinicName={b.providerName}
            address={b.providerAddress}
            city={b.providerCity}
            latitude={b.providerLatitude}
            longitude={b.providerLongitude}
          />
          {!!b.providerPhone && <Text style={styles.phone}>Call: {b.providerPhone}</Text>}
        </View>

        {b.status === 'AWAITING_PAYMENT' && (
          <AppButton title="Pay the advance" onPress={() => navigation.navigate('CarePayment', { bookingId: b.id })} />
        )}
        {b.canReview && !b.reviewed && (
          <AppButton title="Rate this visit" onPress={() => navigation.navigate('CareReview', { bookingId: b.id, providerName: b.providerName })} />
        )}
        {b.reviewed && <Text style={styles.reviewed}>Thanks for your review.</Text>}
        {cancellable && (
          <AppButton
            title="Cancel booking"
            variant="outline"
            textStyle={{ color: colors.danger }}
            style={{ borderColor: colors.danger, marginTop: 10 }}
            onPress={cancel}
            loading={cancelling}
          />
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  title: { fontSize: 17, fontWeight: '800', color: colors.text, flex: 1, marginRight: 8 },
  sub: { fontSize: 13, color: colors.textSecondary, marginTop: 2, marginBottom: 6 },
  k: { fontSize: 13, color: colors.textSecondary, flex: 1 },
  v: { fontSize: 13, color: colors.text, fontWeight: '600', flex: 1.4, textAlign: 'right' },
  sep: { height: 1, backgroundColor: colors.border, marginTop: 10 },
  test: { fontSize: 11, color: colors.info, marginTop: 8 },
  phone: { fontSize: 13, color: colors.text, marginTop: 10, fontWeight: '600' },
  reviewed: { textAlign: 'center', color: colors.textSecondary, fontSize: 13, marginTop: 6 },
});
