import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { doctorApi, ScheduleSlot } from '../../api/doctorApi';
import { hhmm, todayIso } from '../../utils/helpers';

/** Today's slots at a glance on the doctor's home: booked by customers, free, and the ones the doctor blocked. */
export const TodaySlotsCard: React.FC<{ onPress: () => void }> = ({ onPress }) => {
  const [slots, setSlots] = useState<ScheduleSlot[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      doctorApi.getMySchedule(todayIso()).then(setSlots).catch(() => setSlots(null));
    }, [])
  );

  const count = (s: ScheduleSlot['status']) => (slots ?? []).filter((x) => x.status === s).length;
  const shown = (slots ?? []).filter((s) => s.status !== 'BREAK');

  const chip = (s: ScheduleSlot) => {
    const base = s.status === 'BOOKED' ? styles.chipBooked : s.status === 'BLOCKED' ? styles.chipBlocked : s.status === 'AVAILABLE' ? styles.chipFree : styles.chipPast;
    const text = s.status === 'BLOCKED' ? styles.textLight : s.status === 'PAST' ? styles.textMuted : styles.textDark;
    return (
      <View key={s.startTime} style={[styles.chip, base]}>
        {s.status === 'BOOKED' && <Ionicons name="lock-closed" size={10} color={colors.primary} />}
        <Text style={[styles.chipText, text]}>{hhmm(s.startTime)}</Text>
      </View>
    );
  };

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.9} testID="today-slots-card">
      <View style={styles.head}>
        <View style={styles.icon}><Ionicons name="time" size={22} color={colors.primary} /></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>My day: slots</Text>
          <Text style={styles.sub}>
            {slots === null ? 'Loading...' : slots.length === 0 ? 'Not working today' : `${count('BOOKED')} booked · ${count('AVAILABLE')} free · ${count('BLOCKED')} blocked by you`}
          </Text>
        </View>
        <View style={styles.pill}>
          <Text style={styles.pillText}>Manage</Text>
          <Ionicons name="arrow-forward" size={13} color="#FFFFFF" />
        </View>
      </View>

      {slots !== null && slots.length > 0 && (
        <View style={styles.bar}>
          {count('BOOKED') > 0 && <View style={[styles.seg, { flex: count('BOOKED'), backgroundColor: colors.secondary }]} />}
          {count('BLOCKED') > 0 && <View style={[styles.seg, { flex: count('BLOCKED'), backgroundColor: '#14171C' }]} />}
          {count('AVAILABLE') > 0 && <View style={[styles.seg, { flex: count('AVAILABLE'), backgroundColor: colors.border }]} />}
        </View>
      )}

      {shown.length > 0 && <View style={styles.chips}>{shown.map(chip)}</View>}

      <Text style={styles.hint}>See what customers booked and block time. Booked slots are locked; you can undo only the slots you blocked.</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: colors.mintDark },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: { width: 42, height: 42, borderRadius: 14, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 15, fontWeight: '800', color: colors.text },
  sub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.primary, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 18 },
  pillText: { fontSize: 12, fontWeight: '800', color: '#FFFFFF' },
  bar: { flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', marginTop: 14, gap: 2 },
  seg: { height: 8, borderRadius: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 10, borderWidth: 1 },
  chipFree: { backgroundColor: '#FFFFFF', borderColor: colors.border },
  chipBooked: { backgroundColor: colors.mint, borderColor: colors.mintDark },
  chipBlocked: { backgroundColor: '#14171C', borderColor: '#14171C' },
  chipPast: { backgroundColor: '#F1F5F9', borderColor: '#F1F5F9' },
  chipText: { fontSize: 12, fontWeight: '700' },
  textDark: { color: colors.text },
  textLight: { color: '#FFFFFF' },
  textMuted: { color: colors.textMuted },
  hint: { fontSize: 11, color: colors.textMuted, marginTop: 10, lineHeight: 15 },
});
