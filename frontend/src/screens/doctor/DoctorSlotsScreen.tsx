import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, RefreshControl, TouchableOpacity, ScrollView, Animated, Easing, Linking } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { shared } from '../../theme/shared';
import { doctorApi, ScheduleSlot } from '../../api/doctorApi';
import { AppHeader } from '../../components/common/AppHeader';
import { DateField, toIso, fromIso } from '../../components/common/DateField';
import { AppInput } from '../../components/common/AppInput';
import { PhoneField } from '../../components/common/PhoneField';
import { normalizePhone, phoneError } from '../../utils/validators';
import { LoadingView } from '../../components/common/LoadingView';
import { KeyboardAvoid } from '../../components/common/KeyboardScroll';
import { EmptyState } from '../../components/common/EmptyState';
import { DoctorStackParamList } from '../../navigation/types';
import { confirmAction, getErrorMessage, hhmm, notify, todayIso } from '../../utils/helpers';

type Props = NativeStackScreenProps<DoctorStackParamList, 'DoctorSlots'>;

const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const LONG_DAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const SECTIONS: { key: string; label: string; icon: keyof typeof Ionicons.glyphMap; from: number; to: number }[] = [
  { key: 'morning', label: 'Morning', icon: 'sunny-outline', from: 0, to: 12 },
  { key: 'afternoon', label: 'Afternoon', icon: 'partly-sunny-outline', from: 12, to: 17 },
  { key: 'evening', label: 'Evening', icon: 'moon-outline', from: 17, to: 24 },
];

/**
 * The doctor's day as tiles: tap free slots to pick several and mark them as booked in one go, tap a blocked slot to
 * undo it, tap a customer's slot to see who booked it (those are locked and cannot be changed here).
 */
export const DoctorSlotsScreen: React.FC<Props> = ({ navigation }) => {
  const [date, setDate] = useState(todayIso());
  const [slots, setSlots] = useState<ScheduleSlot[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<string[]>([]); // free slots picked to block (start times)
  const [focus, setFocus] = useState<string | null>(null); // a booked or blocked slot being looked at
  const [busy, setBusy] = useState(false);
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('+91 ');
  const [tried, setTried] = useState(false);

  const days = useMemo(() => {
    const out: { iso: string; label: string; num: string }[] = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      out.push({ iso: toIso(d), label: i === 0 ? 'Today' : WEEKDAY[d.getDay()], num: String(d.getDate()) });
    }
    return out;
  }, []);

  const load = useCallback(async (iso: string) => {
    try {
      setSlots(await doctorApi.getMySchedule(iso));
    } catch (e) {
      notify('Error', getErrorMessage(e));
      setSlots([]);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(date); }, [load, date]));

  const pick = (iso: string) => { setSlots(null); setSelected([]); setFocus(null); setDate(iso); };

  const byStart = (t: string) => (slots ?? []).find((s) => s.startTime === t);
  const focused = focus ? byStart(focus) : undefined;
  const counts = useMemo(() => {
    const c = { BOOKED: 0, AVAILABLE: 0, BLOCKED: 0 };
    (slots ?? []).forEach((s) => { if (s.status in c) c[s.status as keyof typeof c]++; });
    return c;
  }, [slots]);
  const usable = counts.BOOKED + counts.AVAILABLE + counts.BLOCKED;

  const d = fromIso(date) ?? new Date();

  // ---- the action bar slides up whenever there is something to do
  const showBar = selected.length > 0 || !!focused;
  const slide = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(slide, { toValue: showBar ? 1 : 0, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [showBar, slide]);

  const callButton = (phone: string, id: string) => (
    <TouchableOpacity style={styles.sheetBtn} onPress={() => Linking.openURL(`tel:${phone}`)} activeOpacity={0.85} testID={id}>
      <Ionicons name="call" size={16} color="#FFFFFF" />
      <Text style={styles.sheetBtnText}>Call {phone}</Text>
    </TouchableOpacity>
  );

  const tap = (s: ScheduleSlot) => {
    if (s.status === 'AVAILABLE' && s.canBlock) {
      setFocus(null);
      setSelected((cur) => (cur.includes(s.startTime) ? cur.filter((x) => x !== s.startTime) : [...cur, s.startTime]));
    } else if (s.status === 'BOOKED' || s.status === 'BLOCKED') {
      setSelected([]);
      setFocus((cur) => (cur === s.startTime ? null : s.startTime));
    }
  };

  const selectAllFree = () => {
    setFocus(null);
    setSelected((slots ?? []).filter((s) => s.status === 'AVAILABLE' && s.canBlock).map((s) => s.startTime));
  };

  const blockSelected = async () => {
    const list = [...selected].sort();
    const hasName = custName.trim().length > 0;
    const hasPhone = custPhone.replace(/[s+]/g, '').length > 2;
    setTried(true);
    if (hasName !== hasPhone || (hasPhone && phoneError(custPhone))) return;
    const who = hasName ? { customerName: custName.trim(), customerPhone: normalizePhone(custPhone) } : undefined;
    const label = list.length === 1 ? hhmm(list[0]) : `${list.length} slots`;
    if (!(await confirmAction('Mark as booked', `${label} will be unavailable to customers. You can undo it later.`, 'Mark as booked'))) return;
    setBusy(true);
    const results = await Promise.allSettled(list.map((t) => doctorApi.blockSlot(date, t, who)));
    const failed = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];
    if (failed.length) notify(`${failed.length} slot${failed.length === 1 ? '' : 's'} could not be marked`, getErrorMessage(failed[0].reason));
    setSelected([]);
    setCustName(''); setCustPhone('+91 '); setTried(false);
    await load(date);
    setBusy(false);
  };

  const unblock = async (s: ScheduleSlot) => {
    if (s.blockId == null) return;
    if (!(await confirmAction('Undo booking', `${hhmm(s.startTime)} will become free and customers can book it again.`, 'Undo', true))) return;
    setBusy(true);
    try {
      await doctorApi.unblockSlot(s.blockId);
      setFocus(null);
      await load(date);
    } catch (e) {
      notify('Could not undo', getErrorMessage(e));
      await load(date);
    } finally {
      setBusy(false);
    }
  };

  const tile = (s: ScheduleSlot) => {
    const isSel = selected.includes(s.startTime);
    const isFocus = focus === s.startTime;
    const interactive = s.status === 'AVAILABLE' ? s.canBlock : s.status === 'BOOKED' || s.status === 'BLOCKED';
    const style =
      s.status === 'BOOKED' ? styles.tBooked
      : s.status === 'BLOCKED' ? styles.tBlocked
      : s.status === 'AVAILABLE' ? (isSel ? styles.tSelected : styles.tFree)
      : styles.tMuted;
    const dark = s.status === 'BLOCKED' || isSel;
    return (
      <TouchableOpacity
        key={s.startTime}
        testID={`slot-${s.startTime}`}
        activeOpacity={0.8}
        disabled={!interactive}
        onPress={() => tap(s)}
        style={[styles.tile, style, isFocus && styles.tFocus]}
      >
        <View style={styles.tileTop}>
          <Text style={[styles.tileTime, dark && { color: '#FFFFFF' }, (s.status === 'BREAK' || s.status === 'PAST') && { color: colors.textMuted }]}>{hhmm(s.startTime)}</Text>
          {s.status === 'BOOKED' && <Ionicons name="lock-closed" size={13} color={colors.primary} />}
          {s.status === 'BLOCKED' && <Ionicons name="close-circle" size={15} color="#FFFFFF" />}
          {s.status === 'AVAILABLE' && (isSel ? <Ionicons name="checkmark-circle" size={16} color={colors.secondary} /> : <Ionicons name="add-circle-outline" size={16} color={colors.success} />)}
        </View>
        <Text style={[styles.tileSub, dark && { color: '#9CA3AF' }]} numberOfLines={1}>
          {s.status === 'BOOKED' ? (s.petName ?? 'Held') : s.status === 'BLOCKED' ? 'Blocked' : s.status === 'AVAILABLE' ? (isSel ? 'Selected' : 'Free') : s.status === 'BREAK' ? 'Break' : 'Passed'}
        </Text>
      </TouchableOpacity>
    );
  };

  const total = Math.max(1, usable);
  return (
    <KeyboardAvoid style={shared.screen}>
      <AppHeader title="My day" subtitle="Booked slots and time you block" showBack onBack={() => navigation.goBack()} />

      <ScrollView
        contentContainerStyle={{ paddingBottom: 150 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(date); }} colors={[colors.primary]} />}
      >
        {/* days */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.days}>
          {days.map((x) => {
            const on = x.iso === date;
            return (
              <TouchableOpacity key={x.iso} style={[styles.dayChip, on && styles.dayChipOn]} onPress={() => pick(x.iso)} activeOpacity={0.85} testID={`day-${x.iso}`}>
                <Text style={[styles.dayLabel, on && { color: colors.mintDark }]}>{x.label}</Text>
                <Text style={[styles.dayNum, on && { color: '#FFFFFF' }]}>{x.num}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        <View style={{ paddingHorizontal: 16 }}>
          <DateField label="Or pick any date" value={date} minimumDate={new Date(new Date().setHours(0, 0, 0, 0))} onChange={(v) => v && pick(v)} testID="slots-date" />
        </View>

        {/* the day at a glance */}
        <View style={styles.hero}>
          <Text style={styles.heroDate}>{LONG_DAY[d.getDay()]}</Text>
          <Text style={styles.heroDay}>{d.getDate()} {MONTH[d.getMonth()]}</Text>
          <View style={styles.bar}>
            {counts.BOOKED > 0 && <View style={[styles.barSeg, { flex: counts.BOOKED, backgroundColor: colors.secondary }]} />}
            {counts.BLOCKED > 0 && <View style={[styles.barSeg, { flex: counts.BLOCKED, backgroundColor: '#FFFFFF' }]} />}
            {counts.AVAILABLE > 0 && <View style={[styles.barSeg, { flex: counts.AVAILABLE, backgroundColor: 'rgba(255,255,255,0.18)' }]} />}
            {usable === 0 && <View style={[styles.barSeg, { flex: total, backgroundColor: 'rgba(255,255,255,0.18)' }]} />}
          </View>
          <View style={styles.heroStats}>
            <Stat color={colors.secondary} value={counts.BOOKED} label="Booked" />
            <Stat color="#FFFFFF" value={counts.BLOCKED} label="Blocked by you" />
            <Stat color="rgba(255,255,255,0.45)" value={counts.AVAILABLE} label="Free" />
          </View>
        </View>

        {slots === null ? (
          <LoadingView />
        ) : slots.length === 0 ? (
          <EmptyState icon="calendar-outline" title="Day off" message="You are not working this day. Change your weekly hours in the Calendar tab." />
        ) : (
          <View style={{ paddingHorizontal: 16 }}>
            {counts.AVAILABLE > 0 && (
              <View style={styles.tools}>
                <Text style={styles.toolsHint}>Tap free slots to pick them</Text>
                <TouchableOpacity style={styles.toolBtn} onPress={selectAllFree} activeOpacity={0.85} testID="select-all-free">
                  <Ionicons name="checkmark-done" size={14} color={colors.primary} />
                  <Text style={styles.toolBtnText}>Select all free</Text>
                </TouchableOpacity>
              </View>
            )}
            {SECTIONS.map((sec) => {
              const list = slots.filter((s) => {
                const h = Number(s.startTime.slice(0, 2));
                return h >= sec.from && h < sec.to;
              });
              if (list.length === 0) return null;
              return (
                <View key={sec.key} style={{ marginTop: 16 }}>
                  <View style={styles.secHead}>
                    <Ionicons name={sec.icon} size={16} color={colors.textSecondary} />
                    <Text style={styles.secTitle}>{sec.label}</Text>
                  </View>
                  <View style={styles.grid}>{list.map(tile)}</View>
                </View>
              );
            })}
            <View style={styles.legend}>
              <Legend color={colors.mintDark} label="Booked by customer (locked)" />
              <Legend color="#14171C" label="Blocked by you" />
              <Legend color={colors.success} label="Free" />
            </View>
          </View>
        )}
      </ScrollView>

      {/* what to do with the slot(s) you tapped */}
      <Animated.View
        pointerEvents={showBar ? 'auto' : 'none'}
        style={[styles.sheet, { opacity: slide, transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [60, 0] }) }] }]}
      >
        {selected.length > 0 ? (
          <>
            <Text style={styles.sheetTitle}>{selected.length} slot{selected.length === 1 ? '' : 's'} selected</Text>
            <Text style={styles.sheetSub}>{[...selected].sort().map(hhmm).join(' · ')}</Text>
            <Text style={styles.formHint}>Booking for someone? Add their details (optional).</Text>
            <AppInput label="Customer name" placeholder="Ravi Kumar" value={custName} onChangeText={setCustName} icon="person-outline" autoCapitalize="words" testID="block-name"
              error={tried && !custName.trim() && custPhone.replace(/[s+]/g, '').length > 2 ? 'Enter the customer name' : undefined} />
            <PhoneField label="Mobile number" value={custPhone} onChange={setCustPhone} forceError={tried && custName.trim().length > 0} testID="block-phone" />
            <View style={styles.sheetBtns}>
              <TouchableOpacity style={[styles.sheetBtn, styles.sheetBtnLight]} onPress={() => setSelected([])} activeOpacity={0.85} testID="clear-selection">
                <Text style={[styles.sheetBtnText, { color: colors.primary }]}>Clear</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.sheetBtn, { flex: 2, marginTop: 0 }]} onPress={blockSelected} disabled={busy} activeOpacity={0.85} testID="block-selected">
                <Ionicons name="remove-circle-outline" size={16} color="#FFFFFF" />
                <Text style={styles.sheetBtnText}>{busy ? 'Marking...' : 'Mark as booked'}</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : focused ? (
          focused.status === 'BOOKED' ? (
            <>
              <View style={styles.sheetHead}>
                <Ionicons name="lock-closed" size={16} color={colors.primary} />
                <Text style={styles.sheetTitle}>{hhmm(focused.startTime)} - {hhmm(focused.endTime)}</Text>
              </View>
              <Text style={styles.sheetMain} testID="booked-detail">{focused.customerName ? `${focused.petName} · ${focused.customerName}` : 'Held for a customer'}</Text>
              {!!focused.customerPhone && <Text style={styles.sheetPhone} testID="booked-phone">{focused.customerPhone}</Text>}
              <Text style={styles.sheetSub}>{focused.note}{focused.reference ? ` · ${focused.reference}` : ''}</Text>
              <Text style={styles.sheetLocked}>Locked. A customer's slot can only be freed by rejecting or cancelling their appointment.</Text>
              {!!focused.customerPhone && callButton(focused.customerPhone, 'call-customer')}
              {focused.appointmentId != null && (
                <TouchableOpacity style={[styles.sheetBtn, !!focused.customerPhone && { backgroundColor: colors.mint, marginTop: 8 }]} onPress={() => navigation.navigate('DoctorAppointmentDetails', { appointmentId: focused.appointmentId! })} activeOpacity={0.85} testID="open-appointment">
                  <Text style={[styles.sheetBtnText, !!focused.customerPhone && { color: colors.primary }]}>Open appointment</Text>
                  <Ionicons name="arrow-forward" size={16} color={focused.customerPhone ? colors.primary : '#FFFFFF'} />
                </TouchableOpacity>
              )}
            </>
          ) : (
            <>
              <View style={styles.sheetHead}>
                <Ionicons name="close-circle" size={16} color={colors.primary} />
                <Text style={styles.sheetTitle}>{hhmm(focused.startTime)} - {hhmm(focused.endTime)}</Text>
              </View>
              <Text style={styles.sheetMain} testID="blocked-detail">{focused.blockedForName ? `Booked for ${focused.blockedForName}` : 'Marked as booked by you'}</Text>
              {!!focused.blockedForPhone && <Text style={styles.sheetPhone}>{focused.blockedForPhone}</Text>}
              {!!focused.blockedForPhone && callButton(focused.blockedForPhone, 'call-blocked')}
              {!!focused.reason && <Text style={styles.sheetSub}>{focused.reason}</Text>}
              <TouchableOpacity style={styles.sheetBtn} onPress={() => unblock(focused)} disabled={busy} activeOpacity={0.85} testID={`unblock-${focused.startTime}`}>
                <Ionicons name="refresh" size={16} color="#FFFFFF" />
                <Text style={styles.sheetBtnText}>{busy ? 'Working...' : 'Undo, make it free'}</Text>
              </TouchableOpacity>
            </>
          )
        ) : null}
      </Animated.View>
    </KeyboardAvoid>
  );
};

const Stat: React.FC<{ color: string; value: number; label: string }> = ({ color, value, label }) => (
  <View style={styles.stat}>
    <View style={styles.statTop}><View style={[styles.statDot, { backgroundColor: color }]} /><Text style={styles.statValue}>{value}</Text></View>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const Legend: React.FC<{ color: string; label: string }> = ({ color, label }) => (
  <View style={styles.legendItem}>
    <View style={[styles.legendDot, { backgroundColor: color }]} />
    <Text style={styles.legendText}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  days: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6, gap: 8 },
  dayChip: { width: 58, paddingVertical: 10, borderRadius: 18, alignItems: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.border },
  dayChipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  dayLabel: { fontSize: 11, fontWeight: '700', color: colors.textSecondary },
  dayNum: { fontSize: 19, fontWeight: '800', color: colors.text, marginTop: 2 },

  hero: { backgroundColor: colors.primary, borderRadius: 24, marginHorizontal: 16, marginTop: 4, padding: 18 },
  heroDate: { color: colors.mintDark, fontSize: 13, fontWeight: '700' },
  heroDay: { color: '#FFFFFF', fontSize: 30, fontWeight: '800', marginTop: 2 },
  bar: { flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', marginTop: 14, gap: 2 },
  barSeg: { height: 10, borderRadius: 5 },
  heroStats: { flexDirection: 'row', marginTop: 14 },
  stat: { flex: 1 },
  statTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statDot: { width: 9, height: 9, borderRadius: 5 },
  statValue: { color: '#FFFFFF', fontSize: 20, fontWeight: '800' },
  statLabel: { color: '#9CA3AF', fontSize: 11, marginTop: 2 },

  tools: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 18 },
  toolsHint: { fontSize: 12, color: colors.textSecondary },
  toolBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.mint, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, borderWidth: 1, borderColor: colors.mintDark },
  toolBtnText: { fontSize: 12, fontWeight: '800', color: colors.primary },

  secHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  secTitle: { fontSize: 14, fontWeight: '800', color: colors.text },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { width: '30.5%', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1.5, minHeight: 58 },
  tileTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tileTime: { fontSize: 15, fontWeight: '800', color: colors.text },
  tileSub: { fontSize: 11, color: colors.textSecondary, marginTop: 3 },
  tFree: { backgroundColor: '#FFFFFF', borderColor: colors.border },
  tSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  tBooked: { backgroundColor: colors.mint, borderColor: colors.mintDark },
  tBlocked: { backgroundColor: '#14171C', borderColor: '#14171C' },
  tMuted: { backgroundColor: '#F1F5F9', borderColor: '#F1F5F9' },
  tFocus: { borderColor: colors.secondary, borderWidth: 2.5 },

  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 20 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 11, color: colors.textSecondary },

  sheet: {
    position: 'absolute', left: 12, right: 12, bottom: 14, backgroundColor: '#FFFFFF', borderRadius: 26, padding: 18,
    borderWidth: 1, borderColor: colors.border,
    shadowColor: '#000000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.12, shadowRadius: 16, elevation: 12,
  },
  sheetPhone: { fontSize: 14, fontWeight: '700', color: colors.primaryLight, marginTop: 3 },
  formHint: { fontSize: 12, color: colors.textSecondary, marginTop: 10, marginBottom: 2 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sheetTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
  sheetMain: { fontSize: 18, fontWeight: '800', color: colors.text, marginTop: 8 },
  sheetSub: { fontSize: 12, color: colors.textSecondary, marginTop: 3, lineHeight: 17 },
  sheetLocked: { fontSize: 11, color: colors.textMuted, marginTop: 8, lineHeight: 15 },
  sheetBtns: { flexDirection: 'row', gap: 10, marginTop: 14 },
  sheetBtn: { flex: 1, height: 50, borderRadius: 25, backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 14 },
  sheetBtnLight: { backgroundColor: colors.mint, marginTop: 0 },
  sheetBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
});
