import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, FlatList, RefreshControl, TouchableOpacity } from 'react-native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { CompositeScreenProps, useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { shared } from '../../theme/shared';
import { appointmentApi, Appointment } from '../../api/appointmentApi';
import { careApi, CareBooking } from '../../api/careApi';
import { AppHeader } from '../../components/common/AppHeader';
import { VisitCard, statusInfo, whenText } from '../../components/appointment/VisitCard';
import { careWhat } from '../../components/care/BookingCard';
import { EmptyState } from '../../components/common/EmptyState';
import { LoadingView } from '../../components/common/LoadingView';
import { CustomerStackParamList, CustomerTabParamList } from '../../navigation/types';
import { confirmAction, getErrorMessage, notify, drName, hhmm, money } from '../../utils/helpers';
import { themedStyles } from '../../theme/themed';

type Props = CompositeScreenProps<
  BottomTabScreenProps<CustomerTabParamList, 'Appointments'>,
  NativeStackScreenProps<CustomerStackParamList>
>;

type Tab = 'UPCOMING' | 'COMPLETED' | 'CANCELLED';
const TABS: { key: Tab; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'UPCOMING', label: 'Coming up', icon: 'calendar' },
  { key: 'COMPLETED', label: 'Past', icon: 'checkmark-done' },
  { key: 'CANCELLED', label: 'Cancelled', icon: 'close-circle' },
];

const EMPTY: Record<Tab, { title: string; message: string }> = {
  UPCOMING: { title: 'Nothing coming up', message: 'Book a visit with a vet, or a grooming, boarding or training session.' },
  COMPLETED: { title: 'No past visits yet', message: 'Visits you have finished will show up here.' },
  CANCELLED: { title: 'Nothing cancelled', message: 'Visits that were cancelled or declined show here.' },
};

/** A vet appointment or a pet-care booking: both live in one list. */
type Visit = { key: string; kind: 'VET' | 'CARE'; appt: Appointment; care?: CareBooking };

const fromVet = (a: Appointment): Visit => ({ key: `vet-${a.id}`, kind: 'VET', appt: a });

/** Shapes a pet-care booking like an appointment so the same card and the same sorting work for both. */
const fromCare = (b: CareBooking): Visit => ({
  key: `care-${b.id}`,
  kind: 'CARE',
  care: b,
  appt: {
    id: b.id,
    bookingReference: b.reference,
    petName: b.petName,
    doctorName: b.providerName,
    clinicName: b.providerName,
    clinicAddress: b.providerAddress ?? '',
    appointmentDate: b.date,
    startTime: b.startTime ?? '',
    endTime: b.endTime ?? '',
    reason: b.checkOutDate ? `${careWhat(b)}, ${b.nights ?? ''} night${b.nights === 1 ? '' : 's'}` : careWhat(b),
    status: b.status === 'REQUESTED' ? 'CONFIRMED' : b.status,
    hasReview: b.reviewed,
    totalAmount: b.totalAmount,
    advanceAmount: b.advanceAmount,
    balanceAmount: b.balanceAmount,
  } as unknown as Appointment,
});

const when = (v: Visit) => `${v.appt.appointmentDate} ${v.appt.startTime || '00:00'}`;

export const MyAppointmentsScreen: React.FC<Props> = ({ navigation, route }) => {
  const [tab, setTab] = useState<Tab>(route.params?.initialTab ?? 'UPCOMING');
  const [items, setItems] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [openKey, setOpenKey] = useState<string | null>(null);

  useEffect(() => {
    if (route.params?.initialTab) setTab(route.params.initialTab);
  }, [route.params?.initialTab]);

  const load = useCallback(async () => {
    try {
      // the pet-care list is a bonus: if it cannot be read, the vet visits still show
      const [vets, cares] = await Promise.all([
        appointmentApi.getMyAppointments(tab, 0, 50),
        careApi.myBookings(tab).catch(() => null),
      ]);
      setItems([...vets.data.content.map(fromVet), ...(cares ? cares.content.map(fromCare) : [])]);
    } catch (e) {
      notify('Error', getErrorMessage(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tab]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load])
  );

  // the soonest first when looking ahead, the latest first when looking back
  const order = (list: Visit[]) => [...list].sort((x, y) => (tab === 'UPCOMING' ? when(x).localeCompare(when(y)) : when(y).localeCompare(when(x))));
  const clinic = useMemo(() => order(items.filter((v) => v.kind === 'VET')), [items, tab]); // eslint-disable-line react-hooks/exhaustive-deps
  const petCare = useMemo(() => order(items.filter((v) => v.kind === 'CARE')), [items, tab]); // eslint-disable-line react-hooks/exhaustive-deps

  // clinic visits first, then pet care, each under its own heading
  type Row =
    | { type: 'head'; key: string; title: string; icon: keyof typeof Ionicons.glyphMap; count: number }
    | { type: 'hero'; key: string; visit: Visit }
    | { type: 'card'; key: string; visit: Visit }
    | { type: 'none'; key: string; text: string };
  const rows = useMemo<Row[]>(() => {
    if (!clinic.length && !petCare.length) return [];
    const out: Row[] = [{ type: 'head', key: 'h-clinic', title: 'Clinic visits', icon: 'medkit', count: clinic.length }];
    if (!clinic.length) out.push({ type: 'none', key: 'n-clinic', text: tab === 'UPCOMING' ? 'No clinic visits coming up.' : 'No clinic visits here.' });
    clinic.forEach((v, i) => out.push(tab === 'UPCOMING' && i === 0 ? { type: 'hero', key: 'hero-' + v.key, visit: v } : { type: 'card', key: v.key, visit: v }));
    out.push({ type: 'head', key: 'h-care', title: 'Pet care', icon: 'paw', count: petCare.length });
    if (!petCare.length) out.push({ type: 'none', key: 'n-care', text: tab === 'UPCOMING' ? 'No grooming, boarding or training coming up.' : 'No pet-care bookings here.' });
    petCare.forEach((v) => out.push({ type: 'card', key: v.key, visit: v }));
    return out;
  }, [clinic, petCare, tab]);

  const open = (v: Visit) => {
    if (v.kind === 'CARE') {
      return v.appt.status === 'AWAITING_PAYMENT'
        ? navigation.navigate('CarePayment', { bookingId: v.appt.id })
        : navigation.navigate('CareBookingDetails', { bookingId: v.appt.id });
    }
    return v.appt.status === 'AWAITING_PAYMENT'
      ? navigation.navigate('AppointmentPayment', { appointmentId: v.appt.id })
      : navigation.navigate('AppointmentDetails', { appointmentId: v.appt.id });
  };

  const cancel = async (v: Visit) => {
    const a = v.appt;
    try {
      if (v.kind === 'CARE') {
        const preview = await careApi.cancellationPreview(a.id);
        if (!(await confirmAction('Cancel this booking?', `${a.petName} at ${a.doctorName}, ${whenText(a.appointmentDate)}.\n\n${preview.message}`, 'Cancel booking', true))) return;
        await careApi.cancel(a.id, 'Cancelled by customer');
        notify('Booking cancelled', preview.refundable ? `Your refund of ${money(preview.refundAmount)} is on its way.` : 'The advance is not refundable at this time.');
      } else {
        const preview = await appointmentApi.cancellationPreview(a.id);
        if (!(await confirmAction('Cancel this visit?', `${a.petName} with ${drName(a.doctorName)}, ${whenText(a.appointmentDate)} at ${hhmm(a.startTime)}.\n\n${preview.message}`, 'Cancel visit', true))) return;
        await appointmentApi.cancelAppointment(a.id, 'Cancelled by customer');
      }
      setOpenKey(null);
      load();
    } catch (e) {
      notify('Could not cancel', getErrorMessage(e));
    }
  };

  const card = (v: Visit) => {
    const a = v.appt;
    return (
      <VisitCard
        key={v.key}
        appointment={a}
        care={v.kind === 'CARE'}
        expanded={openKey === v.key}
        onToggle={() => setOpenKey(openKey === v.key ? null : v.key)}
        onOpen={() => open(v)}
        onPay={() => (v.kind === 'CARE' ? navigation.navigate('CarePayment', { bookingId: a.id }) : navigation.navigate('AppointmentPayment', { appointmentId: a.id }))}
        onCancel={() => cancel(v)}
        onReview={() => (v.kind === 'CARE'
          ? navigation.navigate('CareReview', { bookingId: a.id, providerName: a.doctorName })
          : navigation.navigate('AddReview', { doctorId: a.doctorId, doctorName: a.doctorName, appointmentId: a.id }))}
        onBookAgain={() => (v.kind === 'CARE' && v.care
          ? navigation.navigate('CareProvider', { providerId: v.care.providerId })
          : navigation.navigate('BookAppointment', { doctorId: a.doctorId }))}
      />
    );
  };

  const hero = (next: Visit) => {
    const s = statusInfo(next.appt);
    const pay = next.appt.status === 'AWAITING_PAYMENT';
    const isCare = next.kind === 'CARE';
    return (
      <TouchableOpacity style={styles.hero} onPress={() => open(next)} activeOpacity={0.9} testID="next-visit">
        <Text style={styles.heroLabel}>NEXT VISIT</Text>
        <Text style={styles.heroWhen}>{whenText(next.appt.appointmentDate)}</Text>
        {!!next.appt.startTime && <Text style={styles.heroTime}>{hhmm(next.appt.startTime)}</Text>}
        <Text style={styles.heroWho} numberOfLines={1}>
          {isCare ? `${next.appt.petName} at ${next.appt.doctorName}` : `${next.appt.petName} with ${drName(next.appt.doctorName)}`}
        </Text>
        <View style={styles.heroRow}>
          <View style={[styles.heroChip, { backgroundColor: s.bg }]}>
            <Ionicons name={s.icon} size={13} color={s.color} />
            <Text style={[styles.heroChipText, { color: s.color }]}>{s.label}</Text>
          </View>
          <View style={styles.heroGo}>
            <Text style={styles.heroGoText}>{pay ? 'Pay now' : 'Open'}</Text>
            <Ionicons name="arrow-forward" size={14} color="#14171C" />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={shared.screen}>
      <AppHeader title="Visits" subtitle="Vet visits and pet-care bookings" />
      <View style={styles.tabs}>
        {TABS.map((t) => {
          const on = tab === t.key;
          return (
            <TouchableOpacity key={t.key} style={[styles.tab, on && styles.tabOn]} onPress={() => { setTab(t.key); setOpenKey(null); }} activeOpacity={0.85} testID={`visits-tab-${t.key}`}>
              <Ionicons name={t.icon} size={15} color={on ? '#FFFFFF' : colors.textSecondary} />
              <Text style={[styles.tabText, on && { color: '#FFFFFF' }]}>{t.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {loading ? (
        <LoadingView />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => r.key}
          contentContainerStyle={shared.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          ListEmptyComponent={
            <EmptyState
              icon="calendar-outline"
              title={EMPTY[tab].title}
              message={EMPTY[tab].message}
              actionTitle={tab === 'UPCOMING' ? 'Find a Doctor' : undefined}
              onAction={() => navigation.navigate('FindDoctors')}
            />
          }
          renderItem={({ item }) => {
            if (item.type === 'head') {
              return (
                <View style={styles.head}>
                  <View style={styles.headIcon}><Ionicons name={item.icon} size={16} color={colors.primary} /></View>
                  <Text style={styles.headText}>{item.title}</Text>
                  {item.count > 0 && <View style={styles.headCount}><Text style={styles.headCountText}>{item.count}</Text></View>}
                </View>
              );
            }
            if (item.type === 'none') return <Text style={styles.none}>{item.text}</Text>;
            if (item.type === 'hero') return hero(item.visit);
            return card(item.visit);
          }}
        />
      )}
    </View>
  );
};

const styles = themedStyles(() => ({
  tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 12 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 16, backgroundColor: colors.subtle },
  tabOn: { backgroundColor: '#14171C' },
  tabText: { fontSize: 13, fontWeight: '800', color: colors.textSecondary },
  hero: { backgroundColor: '#14171C', borderRadius: 26, padding: 20, marginBottom: 16 },
  heroLabel: { fontSize: 11, fontWeight: '800', color: colors.secondary, letterSpacing: 1 },
  heroWhen: { fontSize: 30, fontWeight: '800', color: '#FFFFFF', marginTop: 6, letterSpacing: -0.5 },
  heroTime: { fontSize: 20, fontWeight: '700', color: colors.skyOnDark, marginTop: 2 },
  heroWho: { fontSize: 14, color: '#9CA3AF', marginTop: 10 },
  heroRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 },
  heroChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 11, paddingVertical: 6, borderRadius: 14 },
  heroChipText: { fontSize: 12, fontWeight: '800' },
  heroGo: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.secondary, paddingHorizontal: 16, paddingVertical: 9, borderRadius: 16 },
  heroGoText: { fontSize: 13, fontWeight: '800', color: '#14171C' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, marginBottom: 10 },
  headIcon: { width: 28, height: 28, borderRadius: 9, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
  headText: { fontSize: 18, fontWeight: '800', color: colors.ink },
  headCount: { minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, backgroundColor: colors.subtle, alignItems: 'center', justifyContent: 'center' },
  headCountText: { fontSize: 12, fontWeight: '800', color: colors.textSecondary },
  none: { fontSize: 13, color: colors.textSecondary, marginBottom: 16, marginLeft: 2 },
  later: { fontSize: 13, fontWeight: '800', color: colors.textSecondary, marginBottom: 10, letterSpacing: 0.5 },
}));
