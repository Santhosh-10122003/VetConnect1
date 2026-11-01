import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { shared } from '../../theme/shared';
import { doctorApi, DoctorLeave } from '../../api/doctorApi';
import { DateField } from '../common/DateField';
import { AppInput } from '../common/AppInput';
import { confirmAction, getErrorMessage, notify, todayIso } from '../../utils/helpers';

const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pretty = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTH[m - 1]}${y !== new Date().getFullYear() ? ' ' + y : ''}`;
};
export const leaveRange = (l: DoctorLeave) => (l.fromDate === l.toDate ? pretty(l.fromDate) : `${pretty(l.fromDate)} to ${pretty(l.toDate)}`);

/** Days the doctor is away: customers cannot book any slot on them. */
export const LeaveCard: React.FC<{ leave: DoctorLeave[]; onChanged: () => void }> = ({ leave, onChanged }) => {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(todayIso());
  const [to, setTo] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const add = async () => {
    if (!from) return notify('Pick the first day', 'Choose the day your leave starts.');
    if (to && to < from) return notify('Check the dates', 'The last day cannot be before the first day.');
    const label = to && to !== from ? `${pretty(from)} to ${pretty(to)}` : pretty(from);
    if (!(await confirmAction('Add leave', `Customers will not be able to book you on ${label}.`, 'Add leave'))) return;
    setBusy(true);
    try {
      await doctorApi.addLeave(from, to || undefined, reason.trim() || undefined);
      setOpen(false); setTo(''); setReason('');
      onChanged();
    } catch (e) {
      notify('Could not add leave', getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (l: DoctorLeave) => {
    if (!(await confirmAction('Cancel leave', `${leaveRange(l)} will open for booking again.`, 'Cancel leave', true))) return;
    try {
      await doctorApi.removeLeave(l.id);
      onChanged();
    } catch (e) {
      notify('Could not cancel', getErrorMessage(e));
    }
  };

  return (
    <View style={[shared.card, styles.card]} testID="leave-card">
      <View style={styles.head}>
        <View style={styles.icon}><Ionicons name="airplane" size={20} color={colors.primary} /></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Days away</Text>
          <Text style={styles.sub}>{leave.length === 0 ? 'Going on leave? Close whole days to bookings.' : `${leave.length} planned`}</Text>
        </View>
        <TouchableOpacity style={styles.pill} onPress={() => setOpen((o) => !o)} activeOpacity={0.85} testID="leave-toggle">
          <Ionicons name={open ? 'close' : 'add'} size={14} color="#FFFFFF" />
          <Text style={styles.pillText}>{open ? 'Close' : 'Add leave'}</Text>
        </TouchableOpacity>
      </View>

      {leave.map((l) => (
        <View key={l.id} style={styles.row} testID={`leave-${l.id}`}>
          <View style={{ flex: 1 }}>
            <Text style={styles.range}>{leaveRange(l)} <Text style={styles.days}>· {l.days} day{l.days === 1 ? '' : 's'}</Text></Text>
            {!!l.reason && <Text style={styles.reason}>{l.reason}</Text>}
          </View>
          <TouchableOpacity onPress={() => remove(l)} style={styles.remove} testID={`leave-remove-${l.id}`} accessibilityLabel="Cancel leave">
            <Ionicons name="trash-outline" size={18} color={colors.danger} />
          </TouchableOpacity>
        </View>
      ))}

      {open && (
        <View style={styles.form}>
          <DateField label="First day" value={from} minimumDate={new Date(new Date().setHours(0, 0, 0, 0))} onChange={(v) => v && setFrom(v)} testID="leave-from" />
          <DateField label="Last day (leave empty for one day)" value={to} minimumDate={new Date(new Date().setHours(0, 0, 0, 0))} onChange={(v) => setTo(v ?? '')} clearable testID="leave-to" />
          <AppInput label="Reason (optional)" placeholder="e.g. Conference" value={reason} onChangeText={setReason} maxLength={255} testID="leave-reason" />
          <TouchableOpacity style={[styles.save, busy && { opacity: 0.6 }]} onPress={add} disabled={busy} activeOpacity={0.85} testID="leave-save">
            <Text style={styles.saveText}>{busy ? 'Adding...' : 'Add leave'}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: { marginTop: 16, borderColor: colors.mintDark },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: { width: 40, height: 40, borderRadius: 13, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 15, fontWeight: '800', color: colors.text },
  sub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.primary, paddingHorizontal: 13, paddingVertical: 8, borderRadius: 16 },
  pillText: { color: '#FFFFFF', fontWeight: '800', fontSize: 12 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.border, marginTop: 10 },
  range: { fontSize: 14, fontWeight: '800', color: colors.text },
  days: { fontWeight: '600', color: colors.textSecondary },
  reason: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  remove: { padding: 6 },
  form: { marginTop: 14, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12 },
  save: { backgroundColor: colors.primary, borderRadius: 16, paddingVertical: 13, alignItems: 'center' },
  saveText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
});
