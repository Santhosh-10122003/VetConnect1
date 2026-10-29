import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { shared } from '../../theme/shared';
import type { Appointment } from '../../api/appointmentApi';
import { AppButton } from '../common/AppButton';
import { AppInput } from '../common/AppInput';
import { confirmAction, hhmm } from '../../utils/helpers';

interface Props {
  appt: Appointment;
  busy: boolean;
  onApprove: () => void;
  onDecline: (reason: string) => void;
}

/** What the doctor sees when the owner asks to move an appointment: the old and new time, and approve / decline. */
export const RescheduleRequestCard: React.FC<Props> = ({ appt, busy, onApprove, onDecline }) => {
  const req = appt.rescheduleRequest;
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  if (!req) return null;

  const decline = async () => {
    if (reason.trim().length < 3) { setError('Give the owner a short reason, e.g. that day is fully booked.'); return; }
    if (!(await confirmAction('Decline reschedule', 'The customer keeps the original time and sees your reason.', 'Decline', true))) return;
    onDecline(reason.trim());
  };

  return (
    <View style={[shared.card, styles.card]} testID="reschedule-card">
      <View style={styles.head}>
        <Ionicons name="swap-horizontal" size={20} color={colors.warning} />
        <Text style={styles.title}>Reschedule requested</Text>
      </View>
      <Text style={styles.intro}>{appt.customerName} would like to move this appointment. It stays as it is until you approve.</Text>

      <View style={styles.times}>
        <View style={styles.timeBox}>
          <Text style={shared.label}>Current</Text>
          <Text style={styles.time}>{appt.appointmentDate}</Text>
          <Text style={styles.time}>{hhmm(appt.startTime)} - {hhmm(appt.endTime)}</Text>
        </View>
        <Ionicons name="arrow-forward" size={20} color={colors.textMuted} />
        <View style={[styles.timeBox, styles.newBox]}>
          <Text style={shared.label}>Requested</Text>
          <Text style={styles.time} testID="requested-date">{req.appointmentDate}</Text>
          <Text style={styles.time}>{hhmm(req.startTime)} - {hhmm(req.endTime)}</Text>
        </View>
      </View>

      {!!req.note && <Text style={styles.note}>Owner's note: {req.note}</Text>}

      {declining ? (
        <View style={{ marginTop: 12 }}>
          <AppInput
            label="Reason for declining (required)"
            placeholder="e.g. That day is fully booked"
            value={reason}
            onChangeText={(v) => { setReason(v); if (error) setError(''); }}
            error={error || undefined}
            multiline
            maxLength={500}
          />
          <View style={styles.actions}>
            <AppButton title="Back" variant="outline" style={styles.btn} disabled={busy} onPress={() => setDeclining(false)} />
            <AppButton title="Send decline" variant="danger" style={styles.btn} loading={busy} onPress={decline} />
          </View>
        </View>
      ) : (
        <View style={styles.actions}>
          <AppButton title="Decline" variant="outline" style={styles.btn} disabled={busy} onPress={() => setDeclining(true)} testID="reschedule-decline" />
          <AppButton title="Approve" style={styles.btn} loading={busy} onPress={onApprove} testID="reschedule-approve" />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: { borderColor: colors.warning, borderWidth: 1.5, backgroundColor: '#FFFBEB' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 16, fontWeight: '800', color: colors.text },
  intro: { fontSize: 13, color: colors.textSecondary, marginTop: 6, lineHeight: 19 },
  times: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 12 },
  timeBox: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 12, padding: 10, borderWidth: 1, borderColor: colors.border },
  newBox: { borderColor: colors.primary, backgroundColor: colors.mint },
  time: { fontSize: 13, fontWeight: '700', color: colors.text, marginTop: 2 },
  note: { fontSize: 13, color: colors.text, marginTop: 10, fontStyle: 'italic' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  btn: { flex: 1, height: 46 },
});
