import { ClinicLocationCard } from '../../components/common/ClinicLocationCard';
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { shared } from '../../theme/shared';
import { appointmentApi, Appointment } from '../../api/appointmentApi';
import { doctorApi, AvailableSlot } from '../../api/doctorApi';
import { medicalApi, MedicalRecord } from '../../api/medicalApi';
import { AppHeader } from '../../components/common/AppHeader';
import { AppButton } from '../../components/common/AppButton';
import { AppInput } from '../../components/common/AppInput';
import { LoadingView } from '../../components/common/LoadingView';
import { StatusBadge } from '../../components/common/StatusBadge';
import { TimeSlotPicker } from '../../components/appointment/TimeSlotPicker';
import { CustomerStackParamList } from '../../navigation/types';
import { confirmAction, getErrorMessage, hhmm, notify, todayIso, drName, money } from '../../utils/helpers';

type Props = NativeStackScreenProps<CustomerStackParamList, 'AppointmentDetails'>;

const Field: React.FC<{ label: string; value?: string | number }> = ({ label, value }) => (
  <View style={{ marginBottom: 10 }}>
    <Text style={shared.label}>{label}</Text>
    <Text style={shared.value}>{value ?? '-'}</Text>
  </View>
);

export const AppointmentDetailsScreen: React.FC<Props> = ({ navigation, route }) => {
  const { appointmentId } = route.params;
  const [appt, setAppt] = useState<Appointment | null>(null);
  const [record, setRecord] = useState<MedicalRecord | null>(null);
  const [busy, setBusy] = useState(false);

  const [rescheduling, setRescheduling] = useState(false);
  const [date, setDate] = useState(todayIso());
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [slot, setSlot] = useState<AvailableSlot | null>(null);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [rescheduleNote, setRescheduleNote] = useState('');

  const load = useCallback(async () => {
    try {
      const a = (await appointmentApi.getAppointmentById(appointmentId)).data;
      setAppt(a);
      if (a.status === 'COMPLETED') {
        const recs = (await medicalApi.getPetMedicalRecords(a.petId)).data;
        setRecord(recs.find((r) => r.appointmentId === a.id) ?? null);
      }
    } catch (e) {
      notify('Error', getErrorMessage(e));
    }
  }, [appointmentId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    if (!rescheduling || !appt) return;
    setSlotsLoading(true);
    setSlot(null);
    doctorApi
      .getDoctorAvailability(appt.doctorId, date)
      .then((r) => setSlots(r.data))
      .catch(() => setSlots([]))
      .finally(() => setSlotsLoading(false));
  }, [rescheduling, date, appt?.doctorId]);

  if (!appt) return <LoadingView />;

  const isOpen = appt.status === 'PENDING' || appt.status === 'CONFIRMED';
  const awaitingPayment = appt.status === 'AWAITING_PAYMENT';

  const cancel = async () => {
    setBusy(true);
    try {
      const preview = await appointmentApi.cancellationPreview(appt.id);
      if (!(await confirmAction('Cancel appointment', `${preview.message}\n\nThis will release your slot.`, 'Cancel appointment', true))) return;
      await appointmentApi.cancelAppointment(appt.id, 'Cancelled by customer');
      await load();
    } catch (e) {
      notify('Could not cancel', getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const withdraw = async () => {
    setBusy(true);
    try {
      await appointmentApi.withdrawReschedule(appt.id);
      await load();
    } catch (e) {
      notify('Could not withdraw', getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const reschedule = async () => {
    if (!slot) return notify('Select a slot', 'Pick a new date and time first.');
    setBusy(true);
    try {
      await appointmentApi.rescheduleAppointment(appt.id, {
        appointmentDate: date,
        startTime: slot.startTime,
        endTime: slot.endTime,
        note: rescheduleNote.trim() || undefined,
      });
      setRescheduling(false);
      setRescheduleNote('');
      await load();
      notify('Request sent', 'The doctor will approve or decline the new time. Your current appointment stays until then.');
    } catch (e) {
      notify('Could not reschedule', getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={shared.screen}>
      <AppHeader title="Appointment" subtitle={appt.bookingReference} showBack onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={shared.content}>
        <View style={shared.card}>
          <View style={shared.rowBetween}>
            <StatusBadge status={appt.status} />
            <Text style={styles.when}>
              {appt.appointmentDate} · {hhmm(appt.startTime)}-{hhmm(appt.endTime)}
            </Text>
          </View>
          {appt.cancellationReason ? <Text style={styles.cancelNote}>Reason: {appt.cancellationReason}</Text> : null}
        </View>

        <View style={shared.card}>
          <Text style={shared.sectionTitle}>Doctor</Text>
          <Field label="Name" value={drName(appt.doctorName)} />
          <Field label="Consultation fee" value={money(appt.totalAmount || appt.consultationFee)} />
        </View>

        {appt.advanceAmount > 0 && (
          <View style={shared.card}>
            <Text style={shared.sectionTitle}>Payment</Text>
            <Field label="Advance" value={`${money(appt.advanceAmount)}${appt.payment?.status === 'PAID' || appt.payment?.status === 'REFUNDED' || appt.payment?.status === 'PARTIALLY_REFUNDED' ? ' (paid)' : ''}`} />
            <Field label="Balance at the clinic" value={money(appt.balanceAmount)} />
            {!!appt.payment && appt.payment.refundedAmount > 0 && <Field label="Refunded" value={money(appt.payment.refundedAmount)} />}
          </View>
        )}

        <View style={shared.card}>
          <Text style={shared.sectionTitle}>Clinic</Text>
          <ClinicLocationCard
            clinicName={appt.clinicName}
            address={appt.clinicAddress}
            city={appt.clinicCity}
            latitude={appt.clinicLatitude}
            longitude={appt.clinicLongitude}
          />
        </View>

        <View style={shared.card}>
          <Text style={shared.sectionTitle}>Pet & visit</Text>
          <Field label="Pet" value={`${appt.petName} (${appt.petSpecies})`} />
          <Field label="Reason for visit" value={appt.reason} />
          {appt.notes ? <Field label="Notes" value={appt.notes} /> : null}
        </View>

        {record && (
          <View style={shared.card}>
            <Text style={shared.sectionTitle}>Consultation summary</Text>
            <Field label="Diagnosis" value={record.diagnosis} />
            {record.symptoms ? <Field label="Symptoms" value={record.symptoms} /> : null}
            {record.treatmentPlan ? <Field label="Treatment plan" value={record.treatmentPlan} /> : null}
            {record.prescriptions.map((p) => (
              <View key={p.id} style={styles.rx}>
                <Ionicons name="medical-outline" size={16} color={colors.primary} />
                <Text style={styles.rxText}>
                  {p.medicationName} — {p.dosage}, {p.frequency}, {p.durationDays} days
                </Text>
              </View>
            ))}
          </View>
        )}

        {rescheduling && (
          <View style={shared.card}>
            <TimeSlotPicker
              slots={slots}
              selectedSlot={slot}
              onSelectSlot={setSlot}
              selectedDate={date}
              onSelectDate={setDate}
              loading={slotsLoading}
            />
            <AppInput label="Why do you need another time? (optional)" placeholder="e.g. Work meeting that day" value={rescheduleNote} onChangeText={setRescheduleNote} maxLength={500} />
            <Text style={styles.hint}>The doctor has to approve the new time. Until then your current appointment stays as it is.</Text>
            <AppButton title="Send Reschedule Request" onPress={reschedule} loading={busy} />
            <AppButton title="Keep Current Time" variant="outline" style={{ marginTop: 8 }} onPress={() => setRescheduling(false)} />
          </View>
        )}

        {awaitingPayment && (
          <View style={{ gap: 10 }}>
            <AppButton title={`Pay the advance (${money(appt.advanceAmount)})`} onPress={() => navigation.navigate('AppointmentPayment', { appointmentId: appt.id })} />
            <AppButton title="Cancel Appointment" variant="danger" loading={busy} onPress={cancel} />
          </View>
        )}

        {isOpen && !rescheduling && (
          <View style={{ gap: 10 }}>
            {appt.rescheduleRequest ? (
              <View style={styles.pending} testID="reschedule-pending">
                <Ionicons name="hourglass-outline" size={20} color={colors.warning} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.pendingTitle}>Reschedule request sent</Text>
                  <Text style={styles.pendingText}>
                    Waiting for {drName(appt.doctorName)} to approve {appt.rescheduleRequest.appointmentDate} · {hhmm(appt.rescheduleRequest.startTime)}-{hhmm(appt.rescheduleRequest.endTime)}. Your current time stays until then.
                  </Text>
                  <AppButton title="Withdraw request" variant="outline" style={{ marginTop: 10, height: 42 }} loading={busy} onPress={withdraw} />
                </View>
              </View>
            ) : (
              <AppButton title="Reschedule" variant="outline" onPress={() => setRescheduling(true)} />
            )}
            <AppButton title="Cancel Appointment" variant="danger" loading={busy} onPress={cancel} />
          </View>
        )}

        {appt.status === 'COMPLETED' && !appt.hasReview && (
          <AppButton
            title="Leave a Review"
            onPress={() =>
              navigation.navigate('AddReview', { doctorId: appt.doctorId, doctorName: appt.doctorName, appointmentId: appt.id })
            }
          />
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  when: { fontSize: 13, fontWeight: '600', color: colors.primary },
  hint: { fontSize: 12, color: colors.textSecondary, marginBottom: 10, lineHeight: 17 },
  pending: { flexDirection: 'row', gap: 10, backgroundColor: '#FFFBEB', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.warning },
  pendingTitle: { fontSize: 14, fontWeight: '800', color: colors.text },
  pendingText: { fontSize: 13, color: colors.textSecondary, marginTop: 4, lineHeight: 18 },
  cancelNote: { marginTop: 10, fontSize: 13, color: colors.danger },
  rx: { flexDirection: 'row', gap: 8, alignItems: 'center', paddingVertical: 4 },
  rxText: { flex: 1, fontSize: 13, color: colors.text },
});
