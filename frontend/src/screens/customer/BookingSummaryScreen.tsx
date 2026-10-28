import { ClinicLocationCard } from '../../components/common/ClinicLocationCard';
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { shared } from '../../theme/shared';
import { appointmentApi, Appointment } from '../../api/appointmentApi';
import { AppHeader } from '../../components/common/AppHeader';
import { AppButton } from '../../components/common/AppButton';
import { LoadingView } from '../../components/common/LoadingView';
import { StatusBadge } from '../../components/common/StatusBadge';
import { CustomerStackParamList } from '../../navigation/types';
import { getErrorMessage, hhmm, notify, drName, money } from '../../utils/helpers';

type Props = NativeStackScreenProps<CustomerStackParamList, 'BookingSummary'>;

const Line: React.FC<{ icon: keyof typeof Ionicons.glyphMap; label: string; value?: string }> = ({ icon, label, value }) => (
  <View style={styles.line}>
    <Ionicons name={icon} size={18} color={colors.primary} />
    <View style={{ flex: 1 }}>
      <Text style={shared.label}>{label}</Text>
      <Text style={shared.value}>{value || '-'}</Text>
    </View>
  </View>
);

export const BookingSummaryScreen: React.FC<Props> = ({ navigation, route }) => {
  const { appointmentId } = route.params;
  const [appt, setAppt] = useState<Appointment | null>(null);

  useEffect(() => {
    appointmentApi
      .getAppointmentById(appointmentId)
      .then((r) => setAppt(r.data))
      .catch((e) => notify('Error', getErrorMessage(e)));
  }, [appointmentId]);

  if (!appt) return <LoadingView />;

  const goToAppointments = () =>
    navigation.reset({
      index: 0,
      routes: [{ name: 'CustomerTabs', params: { screen: 'Appointments', params: { initialTab: 'UPCOMING' } } }],
    });

  return (
    <View style={shared.screen}>
      <AppHeader title="Booking Summary" />
      <ScrollView contentContainerStyle={shared.content}>
        <View style={styles.hero}>
          <View style={styles.check}>
            <Ionicons name="checkmark" size={36} color="#FFFFFF" />
          </View>
          <Text style={styles.heroTitle}>Request sent!</Text>
          <Text style={styles.heroSub}>The doctor will confirm your appointment shortly.</Text>
          <Text style={styles.ref}>{appt.bookingReference}</Text>
          <StatusBadge status={appt.status} />
        </View>

        <View style={shared.card}>
          <Line icon="medkit-outline" label="Doctor" value={drName(appt.doctorName)} />
          <Line icon="business-outline" label="Clinic" value={`${appt.clinicName}, ${appt.clinicAddress}`} />
          <Line icon="paw-outline" label="Pet" value={`${appt.petName} (${appt.petSpecies}${appt.petBreed ? ', ' + appt.petBreed : ''})`} />
          <Line icon="calendar-outline" label="Date" value={appt.appointmentDate} />
          <Line icon="time-outline" label="Time" value={`${hhmm(appt.startTime)} - ${hhmm(appt.endTime)}`} />
          <Line icon="chatbubble-outline" label="Reason" value={appt.reason} />
          <Line icon="cash-outline" label="Consultation fee" value={money(appt.totalAmount || appt.consultationFee)} />
          {appt.advanceAmount > 0 && <Line icon="card-outline" label="Advance paid" value={money(appt.advanceAmount)} />}
          <Line icon="wallet-outline" label="Pay at the clinic" value={money(appt.advanceAmount > 0 ? appt.balanceAmount : appt.consultationFee)} />
        </View>

        <View style={shared.card}>
          <ClinicLocationCard
            clinicName={appt.clinicName}
            address={appt.clinicAddress}
            city={appt.clinicCity}
            latitude={appt.clinicLatitude}
            longitude={appt.clinicLongitude}
            compact
          />
        </View>

        <AppButton title="View My Appointments" onPress={goToAppointments} />
        <AppButton
          title="Back to Home"
          variant="outline"
          style={{ marginTop: 10 }}
          onPress={() => navigation.reset({ index: 0, routes: [{ name: 'CustomerTabs', params: { screen: 'Home' } }] })}
        />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  hero: { alignItems: 'center', marginBottom: 20, gap: 8 },
  check: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: { fontSize: 22, fontWeight: '800', color: colors.text },
  heroSub: { fontSize: 14, color: colors.textSecondary, textAlign: 'center' },
  ref: { fontSize: 18, fontWeight: '800', color: colors.primary, letterSpacing: 1 },
  line: { flexDirection: 'row', gap: 12, paddingVertical: 8 },
});
