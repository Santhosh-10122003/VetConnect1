import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Linking } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { colors } from '../../theme/colors';
import { shared } from '../../theme/shared';
import { appointmentApi, Appointment } from '../../api/appointmentApi';
import { petApi, Pet } from '../../api/petApi';
import { AppHeader } from '../../components/common/AppHeader';
import { AppButton } from '../../components/common/AppButton';
import { RescheduleRequestCard } from '../../components/appointment/RescheduleRequestCard';
import { LoadingView } from '../../components/common/LoadingView';
import { StatusBadge } from '../../components/common/StatusBadge';
import { DoctorStackParamList } from '../../navigation/types';
import { confirmAction, getErrorMessage, hhmm, money, notify, petAge } from '../../utils/helpers';

type Props = NativeStackScreenProps<DoctorStackParamList, 'DoctorAppointmentDetails'>;

const Field: React.FC<{ label: string; value?: string | number | null }> = ({ label, value }) => (
  <View style={{ marginBottom: 10 }}>
    <Text style={shared.label}>{label}</Text>
    <Text style={shared.value}>{value || '-'}</Text>
  </View>
);

export const DoctorAppointmentDetailsScreen: React.FC<Props> = ({ navigation, route }) => {
  const { appointmentId } = route.params;
  const [appt, setAppt] = useState<Appointment | null>(null);
  const [pet, setPet] = useState<Pet | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const a = (await appointmentApi.getAppointmentById(appointmentId)).data;
      setAppt(a);
      // Pet details are visible to the treating doctor; ignore failures so the page still renders.
      petApi.getPetById(a.petId).then((r) => setPet(r.data)).catch(() => setPet(null));
    } catch (e) {
      notify('Error', getErrorMessage(e));
    }
  }, [appointmentId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!appt) return <LoadingView />;

  const run = async (action: () => Promise<unknown>, errTitle: string) => {
    setBusy(true);
    try {
      await action();
      await load();
    } catch (e) {
      notify(errTitle, getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const approveReschedule = () => run(() => appointmentApi.approveReschedule(appt.id), 'Could not approve');
  const declineReschedule = (reason: string) => run(() => appointmentApi.rejectReschedule(appt.id, reason), 'Could not decline');

  const confirm = () => run(() => appointmentApi.confirmAppointment(appt.id), 'Could not confirm');

  const reject = async () => {
    if (await confirmAction('Reject request', `Decline ${appt.petName}'s appointment request?`, 'Reject', true))
      run(() => appointmentApi.rejectAppointment(appt.id, 'Doctor unavailable at this time'), 'Could not reject');
  };

  const cancel = async () => {
    if (await confirmAction('Cancel appointment', 'The owner will be notified and the slot released.', 'Cancel appointment', true))
      run(() => appointmentApi.cancelAppointment(appt.id, 'Cancelled by doctor'), 'Could not cancel');
  };

  return (
    <View style={shared.screen}>
      <AppHeader title="Appointment" subtitle={appt.bookingReference} showBack onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={shared.content}>
        <RescheduleRequestCard appt={appt} busy={busy} onApprove={approveReschedule} onDecline={declineReschedule} />

        <View style={shared.card}>
          <View style={shared.rowBetween}>
            <StatusBadge status={appt.status} />
            <Text style={styles.when}>
              {appt.appointmentDate} · {hhmm(appt.startTime)}-{hhmm(appt.endTime)}
            </Text>
          </View>
          <Text style={styles.reasonLabel}>Reason for visit</Text>
          <Text style={shared.value}>{appt.reason || '-'}</Text>
          {appt.cancellationReason ? <Text style={styles.cancel}>Reason: {appt.cancellationReason}</Text> : null}
        </View>

        {appt.advanceAmount > 0 && (
          <View style={shared.card}>
            <Text style={shared.sectionTitle}>Payment</Text>
            <Field label="Consultation fee" value={money(appt.totalAmount)} />
            <Field label="Advance paid online" value={money(appt.advanceAmount)} />
            <Field label="To collect at the clinic" value={money(appt.balanceAmount)} />
          </View>
        )}

        <View style={shared.card}>
          <Text style={shared.sectionTitle}>Owner</Text>
          <Field label="Name" value={appt.customerName} />
          <Field label="Phone" value={appt.customerPhone} />
          <Field label="Email" value={appt.customerEmail} />
          {appt.customerPhone ? (
            <AppButton title="Call Owner" variant="mint" onPress={() => Linking.openURL(`tel:${appt.customerPhone}`)} />
          ) : null}
        </View>

        <View style={shared.card}>
          <Text style={shared.sectionTitle}>Patient</Text>
          <Field label="Name" value={`${appt.petName} (${appt.petSpecies})`} />
          <Field label="Breed" value={appt.petBreed} />
          {pet && (
            <>
              <Field label="Age" value={petAge(pet.dateOfBirth)} />
              <Field label="Gender" value={pet.gender} />
              <Field label="Weight" value={pet.weight != null ? `${pet.weight} kg` : undefined} />
              <Field label="Allergies" value={pet.allergies} />
              <Field label="Existing conditions" value={pet.existingConditions} />
            </>
          )}
        </View>

        <View style={{ gap: 10 }}>
          {appt.status === 'PENDING' && (
            <>
              <AppButton title="Confirm Appointment" loading={busy} onPress={confirm} />
              <AppButton title="Reject" variant="outline" onPress={reject} disabled={busy} />
            </>
          )}
          {appt.status === 'CONFIRMED' && (
            <>
              <AppButton
                title="Start Consultation & Complete"
                disabled={busy}
                onPress={() => navigation.navigate('ConsultationNotes', { appointmentId: appt.id, petId: appt.petId, petName: appt.petName })}
              />
              <AppButton title="Cancel Appointment" variant="danger" disabled={busy} onPress={cancel} />
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  when: { fontSize: 13, fontWeight: '600', color: colors.primary },
  reasonLabel: { marginTop: 14, fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  cancel: { marginTop: 10, fontSize: 13, color: colors.danger },
});
