import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { CompositeScreenProps, useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { useAuth } from '../../context/AuthContext';
import { notificationApi } from '../../api/notificationApi';
import { appointmentApi, Appointment } from '../../api/appointmentApi';
import { careApi, CareBooking } from '../../api/careApi';
import { StatusBadge } from '../../components/common/StatusBadge';
import { careWhat, careWhen } from '../../components/care/BookingCard';
import { CustomerTabParamList, CustomerStackParamList } from '../../navigation/types';
import { drName, hhmm } from '../../utils/helpers';

type Props = CompositeScreenProps<
  BottomTabScreenProps<CustomerTabParamList, 'Home'>,
  NativeStackScreenProps<CustomerStackParamList>
>;

type IconName = keyof typeof Ionicons.glyphMap;

/** The home screen: a friendly question, one tap into each part of the app, and what is coming up. */
export const HomeScreen: React.FC<Props> = ({ navigation }) => {
  const { user } = useAuth();
  const [unread, setUnread] = useState(false);
  const [nextVisit, setNextVisit] = useState<Appointment | null>(null);
  const [nextCare, setNextCare] = useState<CareBooking | null>(null);

  useFocusEffect(
    useCallback(() => {
      notificationApi.getRecentNotifications().then((r) => setUnread(!!r.data?.some((n) => !n.isRead))).catch(() => setUnread(false));
      appointmentApi.getMyAppointments('UPCOMING', 0, 1).then((r) => setNextVisit(r.data?.content?.[0] ?? null)).catch(() => setNextVisit(null));
      careApi.myBookings('UPCOMING').then((r) => setNextCare(r.content?.[0] ?? null)).catch(() => setNextCare(null));
    }, [])
  );

  const tabs = (screen: keyof CustomerTabParamList, params?: object) =>
    navigation.navigate('CustomerTabs', { screen, params } as never);

  const tiles: { id: string; label: string; icon: IconName; go: () => void }[] = [
    { id: 'vet', label: 'Veterinary', icon: 'medkit-outline', go: () => tabs('FindDoctors') },
    { id: 'grooming', label: 'Grooming', icon: 'cut-outline', go: () => tabs('PetCare', { category: 'GROOMING' }) },
    { id: 'boarding', label: 'Boarding', icon: 'bed-outline', go: () => tabs('PetCare', { category: 'BOARDING' }) },
    { id: 'training', label: 'Training', icon: 'school-outline', go: () => tabs('PetCare', { category: 'TRAINING' }) },
    { id: 'visits', label: 'Visits', icon: 'calendar-outline', go: () => tabs('Appointments', { initialTab: 'UPCOMING' }) },
    { id: 'orders', label: 'Pet care bookings', icon: 'receipt-outline', go: () => navigation.navigate('CareBookings') },
    { id: 'pets', label: 'My pets', icon: 'paw-outline', go: () => tabs('Pets') },
    { id: 'profile', label: 'Profile', icon: 'person-outline', go: () => tabs('Profile') },
  ];

  const first = (user?.fullName || 'Pet Parent').trim().split(/\s+/)[0];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {/* decorative sky shape behind the greeting */}
      <View style={styles.blob} pointerEvents="none" />

      <View style={styles.topBar}>
        <View style={{ flex: 1 }}>
          <Text style={styles.welcome} numberOfLines={1}>Welcome {first},</Text>
          <Text style={styles.ask}>what are you{'\n'}looking for?</Text>
        </View>
        <View style={styles.topButtons}>
          <TouchableOpacity style={styles.round} onPress={() => tabs('FindDoctors')} activeOpacity={0.85} testID="home-search">
            <Ionicons name="search" size={22} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.round} onPress={() => navigation.navigate('Notifications')} activeOpacity={0.85} testID="home-bell">
            <Ionicons name="notifications-outline" size={22} color={colors.text} />
            {unread && <View style={styles.dot} />}
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.grid}>
        {tiles.map((t) => (
          <TouchableOpacity key={t.id} style={styles.tile} onPress={t.go} activeOpacity={0.85} testID={`home-tile-${t.id}`}>
            <View style={styles.tileIcon}><Ionicons name={t.icon} size={26} color={colors.primary} /></View>
            <Text style={styles.tileLabel} numberOfLines={2}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.section}>Explore</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cards}>
        <TouchableOpacity style={[styles.promo, { backgroundColor: colors.mintDark }]} onPress={() => tabs('FindDoctors')} activeOpacity={0.9} testID="home-promo-vet">
          <Text style={styles.promoEmoji}>🐶</Text>
          <Text style={styles.promoTitle}>See a vet{'\n'}near you</Text>
          <View style={styles.promoBtn}><Text style={styles.promoBtnText}>Book now</Text></View>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.promo, { backgroundColor: '#14171C' }]} onPress={() => tabs('PetCare')} activeOpacity={0.9} testID="home-promo-care">
          <Text style={styles.promoEmoji}>🐱</Text>
          <Text style={[styles.promoTitle, { color: '#FFFFFF' }]}>Pamper{'\n'}your pet</Text>
          <View style={[styles.promoBtn, { backgroundColor: colors.mintDark }]}><Text style={styles.promoBtnText}>Explore</Text></View>
        </TouchableOpacity>
      </ScrollView>

      <Text style={styles.section}>Upcoming</Text>
      {nextVisit || nextCare ? (
        <View style={{ gap: 12 }}>
          {nextVisit && (
            <TouchableOpacity style={styles.row} onPress={() => navigation.navigate('AppointmentDetails', { appointmentId: nextVisit.id })} activeOpacity={0.9} testID="home-next-visit">
              <View style={styles.rowIcon}><Ionicons name="medkit" size={22} color={colors.primary} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle} numberOfLines={1}>{drName(nextVisit.doctorName)}</Text>
                <Text style={styles.rowSub} numberOfLines={1}>{nextVisit.petName} · {nextVisit.appointmentDate} · {hhmm(nextVisit.startTime)}</Text>
              </View>
              <StatusBadge status={nextVisit.status} />
            </TouchableOpacity>
          )}
          {nextCare && (
            <TouchableOpacity
              style={styles.row}
              onPress={() => (nextCare.status === 'AWAITING_PAYMENT' ? navigation.navigate('CarePayment', { bookingId: nextCare.id }) : navigation.navigate('CareBookingDetails', { bookingId: nextCare.id }))}
              activeOpacity={0.9}
              testID="home-next-care"
            >
              <View style={styles.rowIcon}><Ionicons name="cut" size={22} color={colors.primary} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle} numberOfLines={1}>{careWhat(nextCare)}</Text>
                <Text style={styles.rowSub} numberOfLines={1}>{nextCare.providerName} · {careWhen(nextCare)}</Text>
              </View>
              <StatusBadge status={nextCare.status} />
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Nothing booked yet. Pick something above to get started.</Text>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  content: { padding: 22, paddingTop: 58, paddingBottom: 40 },
  blob: { position: 'absolute', top: -130, left: -90, width: 360, height: 330, borderRadius: 180, backgroundColor: colors.mintDark, opacity: 0.55 },
  topBar: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 26 },
  welcome: { fontSize: 24, fontWeight: '800', color: colors.primary },
  ask: { fontSize: 30, fontWeight: '500', color: colors.primary, lineHeight: 36, marginTop: 2 },
  topButtons: { flexDirection: 'row', gap: 10 },
  round: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  dot: { position: 'absolute', top: 9, right: 10, width: 9, height: 9, borderRadius: 5, backgroundColor: colors.danger, borderWidth: 1.5, borderColor: '#FFFFFF' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 14, marginBottom: 8 },
  tile: { width: '25%', alignItems: 'center', paddingHorizontal: 4 },
  tileIcon: {
    width: 62, height: 62, borderRadius: 20, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.mintBorder,
    shadowColor: '#000000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.07, shadowRadius: 8, elevation: 3,
  },
  tileLabel: { fontSize: 11, fontWeight: '700', color: colors.primary, marginTop: 7, textAlign: 'center' },
  section: { fontSize: 20, fontWeight: '800', color: colors.primary, marginTop: 24, marginBottom: 14 },
  cards: { gap: 14, paddingRight: 8 },
  promo: { width: 210, borderRadius: 24, padding: 18, minHeight: 170, overflow: 'hidden' },
  promoEmoji: { position: 'absolute', right: 6, bottom: 6, fontSize: 76 },
  promoTitle: { fontSize: 22, fontWeight: '800', color: colors.primary, lineHeight: 27 },
  promoBtn: { marginTop: 14, alignSelf: 'flex-start', backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingVertical: 9, borderRadius: 18 },
  promoBtnText: { fontSize: 13, fontWeight: '800', color: colors.primary },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFFFFF', borderRadius: 20, padding: 14,
    borderWidth: 1, borderColor: colors.border,
    shadowColor: '#000000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  rowIcon: { width: 46, height: 46, borderRadius: 14, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 15, fontWeight: '800', color: colors.primary },
  rowSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  empty: { backgroundColor: colors.mint, borderRadius: 18, padding: 16 },
  emptyText: { fontSize: 13, color: colors.textSecondary },
});
