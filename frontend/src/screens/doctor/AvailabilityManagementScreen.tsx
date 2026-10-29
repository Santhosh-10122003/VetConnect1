import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Switch, TextInput, TouchableOpacity } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { shared } from '../../theme/shared';
import { doctorApi, DoctorProfile, DoctorAvailability } from '../../api/doctorApi';
import { AppHeader } from '../../components/common/AppHeader';
import { KeyboardScroll } from '../../components/common/KeyboardScroll';
import { AppButton } from '../../components/common/AppButton';
import { LoadingView } from '../../components/common/LoadingView';
import { DAY_NAMES, getErrorMessage, notify } from '../../utils/helpers';

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

interface DayRow {
  dayOfWeek: number;
  isActive: boolean;
  startTime: string;
  endTime: string;
  breakStartTime: string;
  breakEndTime: string;
  slotDurationMinutes: string;
}

const defaultRow = (dayOfWeek: number): DayRow => ({
  dayOfWeek,
  isActive: false,
  startTime: '09:00',
  endTime: '17:00',
  breakStartTime: '',
  breakEndTime: '',
  slotDurationMinutes: '30',
});

const TimeField: React.FC<{ label: string; value: string; onChange: (v: string) => void; editable: boolean; placeholder?: string }> = ({
  label,
  value,
  onChange,
  editable,
  placeholder = 'HH:mm',
}) => (
  <View style={{ flex: 1 }}>
    <Text style={shared.label}>{label}</Text>
    <TextInput
      style={[styles.input, !editable && styles.inputOff]}
      value={value}
      onChangeText={onChange}
      editable={editable}
      placeholder={placeholder}
      placeholderTextColor={colors.textMuted}
      maxLength={5}
      keyboardType="numbers-and-punctuation"
    />
  </View>
);

export const AvailabilityManagementScreen: React.FC = () => {
  const navigation = useNavigation();
  const [doctor, setDoctor] = useState<DoctorProfile | null>(null);
  const [rows, setRows] = useState<DayRow[]>([]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = (await doctorApi.getMyDoctorProfile()).data;
      setDoctor(d);
      setRows(
        DAY_NAMES.map((_, i) => {
          const a = d.availabilities?.find((x) => x.dayOfWeek === i + 1);
          if (!a) return defaultRow(i + 1);
          return {
            dayOfWeek: i + 1,
            isActive: a.isActive,
            startTime: a.startTime.substring(0, 5),
            endTime: a.endTime.substring(0, 5),
            breakStartTime: a.breakStartTime?.substring(0, 5) ?? '',
            breakEndTime: a.breakEndTime?.substring(0, 5) ?? '',
            slotDurationMinutes: String(a.slotDurationMinutes),
          };
        })
      );
    } catch (e) {
      notify('Error', getErrorMessage(e));
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const patch = (i: number, p: Partial<DayRow>) => setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...p } : r)));

  const validate = (): string | null => {
    for (const r of rows) {
      if (!r.isActive) continue;
      const day = DAY_NAMES[r.dayOfWeek - 1];
      if (!TIME_RE.test(r.startTime) || !TIME_RE.test(r.endTime)) return `${day}: use 24-hour times like 09:00.`;
      if (toMin(r.endTime) <= toMin(r.startTime)) return `${day}: end time must be after start time.`;
      const slot = Number(r.slotDurationMinutes);
      if (!Number.isInteger(slot) || slot < 10 || slot > 240) return `${day}: slot length must be 10-240 minutes.`;
      const hasBreak = r.breakStartTime || r.breakEndTime;
      if (hasBreak) {
        if (!TIME_RE.test(r.breakStartTime) || !TIME_RE.test(r.breakEndTime)) return `${day}: enter both break times as HH:mm, or clear both.`;
        if (toMin(r.breakEndTime) <= toMin(r.breakStartTime)) return `${day}: break end must be after break start.`;
        if (toMin(r.breakStartTime) < toMin(r.startTime) || toMin(r.breakEndTime) > toMin(r.endTime)) return `${day}: break must fall inside working hours.`;
      }
    }
    return null;
  };

  const save = async () => {
    if (!doctor) return;
    const problem = validate();
    if (problem) return notify('Check your schedule', problem);

    const availabilities: DoctorAvailability[] = rows
      // Skip untouched days that were never configured; keep configured days so they can be switched off.
      .filter((r) => r.isActive || doctor.availabilities?.some((a) => a.dayOfWeek === r.dayOfWeek))
      .map((r) => ({
        dayOfWeek: r.dayOfWeek,
        startTime: r.startTime,
        endTime: r.endTime,
        breakStartTime: r.breakStartTime || undefined,
        breakEndTime: r.breakEndTime || undefined,
        slotDurationMinutes: Number(r.slotDurationMinutes),
        isActive: r.isActive,
      }));

    setSaving(true);
    try {
      // Only the schedule is sent; the profile is untouched.
      const updated = await doctorApi.updateAvailability({ availabilities });
      setDoctor(updated.data);
      notify('Saved', 'Your weekly schedule has been updated.');
    } catch (e) {
      notify('Could not save schedule', getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  if (!doctor) return <LoadingView />;

  return (
    <View style={shared.screen}>
      <AppHeader title="Calendar & Slots" subtitle="Weekly working hours" />
      <KeyboardScroll contentContainerStyle={shared.content} keyboardShouldPersistTaps="handled">
        <TouchableOpacity style={styles.daysCard} onPress={() => navigation.navigate('DoctorSlots' as never)} activeOpacity={0.9} testID="open-day-slots">
          <Ionicons name="time" size={26} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.daysTitle}>See booked slots and block time</Text>
            <Text style={styles.daysSub}>Check what customers booked on any day, and mark a free slot as booked yourself.</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.primary} />
        </TouchableOpacity>

        {rows.map((r, i) => (
          <View key={r.dayOfWeek} style={shared.card}>
            <View style={shared.rowBetween}>
              <Text style={styles.day}>{DAY_NAMES[i]}</Text>
              <View style={shared.row}>
                <Text style={[styles.state, { color: r.isActive ? colors.success : colors.textMuted }]}>{r.isActive ? 'Working' : 'Day off'}</Text>
                <Switch
                  value={r.isActive}
                  onValueChange={(v) => patch(i, { isActive: v })}
                  trackColor={{ true: colors.primaryLight, false: colors.border }}
                  thumbColor="#FFFFFF"
                />
              </View>
            </View>
            {r.isActive && (
              <View style={{ marginTop: 12, gap: 10 }}>
                <View style={styles.pair}>
                  <TimeField label="Start" value={r.startTime} editable onChange={(v) => patch(i, { startTime: v })} />
                  <TimeField label="End" value={r.endTime} editable onChange={(v) => patch(i, { endTime: v })} />
                </View>
                <View style={styles.pair}>
                  <TimeField label="Break start" value={r.breakStartTime} editable placeholder="optional" onChange={(v) => patch(i, { breakStartTime: v })} />
                  <TimeField label="Break end" value={r.breakEndTime} editable placeholder="optional" onChange={(v) => patch(i, { breakEndTime: v })} />
                </View>
                <View style={styles.pair}>
                  <TimeField label="Slot length (min)" value={r.slotDurationMinutes} editable placeholder="30" onChange={(v) => patch(i, { slotDurationMinutes: v.replace(/\D/g, '') })} />
                  <View style={{ flex: 1 }} />
                </View>
              </View>
            )}
          </View>
        ))}
        <AppButton title="Save Schedule" onPress={save} loading={saving} />
      </KeyboardScroll>
    </View>
  );
};

const styles = StyleSheet.create({
  daysCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.mint, borderRadius: 16, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: colors.mintDark },
  daysTitle: { fontSize: 14, fontWeight: '800', color: colors.text },
  daysSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2, lineHeight: 17 },
  day: { fontSize: 16, fontWeight: '700', color: colors.text },
  state: { fontSize: 12, fontWeight: '600', marginRight: 8 },
  pair: { flexDirection: 'row', gap: 12 },
  input: {
    height: 44,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 15,
    color: colors.text,
    backgroundColor: '#FFFFFF',
  },
  inputOff: { backgroundColor: '#F1F5F9' },
});
