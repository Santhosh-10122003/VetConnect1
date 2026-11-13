import React, { useCallback, useState } from 'react';
import { TakeTourButton } from '../../tour/TakeTourButton';
import { useTour } from '../../tour/TourProvider';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { shared } from '../../theme/shared';
import { careApi, Provider, categoryLabel } from '../../api/careApi';
import { AppHeader } from '../../components/common/AppHeader';
import { KeyboardScroll } from '../../components/common/KeyboardScroll';
import { AppButton } from '../../components/common/AppButton';
import { LoadingView } from '../../components/common/LoadingView';
import { WalletCard } from '../../components/payment/WalletCard';
import { ProviderStatusCard } from '../../components/care/ProviderStatusCard';
import { ProviderStackParamList } from '../../navigation/types';
import { getErrorMessage, notify } from '../../utils/helpers';
import { themedStyles } from '../../theme/themed';
import { VerifiedBadge } from '../../components/common/VerifiedBadge';
import { useTopPad } from '../../utils/useTopPad';

type Props = NativeStackScreenProps<ProviderStackParamList, 'ProviderHome'>;

export const ProviderHomeScreen: React.FC<Props> = ({ navigation }) => {
  const topPad = useTopPad(58);
  const tour = useTour();
  const [profile, setProfile] = useState<Provider | null>(null);
  const [missing, setMissing] = useState(false);
  const [counts, setCounts] = useState({ upcoming: 0, done: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const p = await careApi.myProfile();
      setProfile(p);
      setMissing(false);
      const [r, c] = await Promise.all([careApi.providerBookings('CONFIRMED'), careApi.providerBookings('COMPLETED')]);
      setCounts({ upcoming: r.totalElements, done: c.totalElements });
    } catch (e: any) {
      // a vet doctor has no business profile until they set one up
      if (e?.response?.status === 404) setMissing(true);
      else notify('Error', getErrorMessage(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) return <LoadingView />;

  if (missing || !profile) {
    return (
      <View style={shared.screen}>
        <AppHeader title="Pet Care" subtitle="Grooming, boarding and training" />
        <ScrollView contentContainerStyle={shared.content}>
          <View style={shared.card}>
            <Ionicons name="paw" size={34} color={colors.primary} />
            <Text style={styles.setupTitle}>Offer pet care from your clinic</Text>
            <Text style={styles.setupText}>
              Add grooming, boarding or training to Jenni. Pet owners nearby can book you and pay an advance, and you
              manage your menu, hours and requests here. An admin reviews your business first.
            </Text>
            <AppButton title="Set up my pet-care business" onPress={() => navigation.navigate('ProviderSetup')} />
          </View>
        </ScrollView>
      </View>
    );
  }

  const manage: { id: string; icon: keyof typeof Ionicons.glyphMap; title: string; go: () => void; tour: number }[] = [
    { id: 'services', icon: 'pricetags-outline', title: 'My services', go: () => navigation.navigate('ProviderServices'), tour: 2 },
    { id: 'hours', icon: 'time-outline', title: 'Hours & capacity', go: () => navigation.navigate('ProviderHours'), tour: 3 },
    { id: 'profile', icon: 'storefront-outline', title: 'Business profile', go: () => navigation.navigate('ProviderProfile'), tour: 4 },
    { id: 'account', icon: 'person-circle-outline', title: 'Account', go: () => navigation.navigate('ProviderAccount'), tour: 5 },
  ];
  const approved = profile.verificationStatus === 'APPROVED';
  const statusWord = approved ? 'Live for pet owners' : profile.verificationStatus === 'REJECTED' ? 'Needs changes' : 'Waiting for approval';

  return (
    <View style={styles.page}>
      <View style={styles.blob} pointerEvents="none" />
      <KeyboardScroll
        contentContainerStyle={[styles.content, { paddingTop: topPad }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        <View style={styles.topBar}>
          <View style={{ flex: 1 }}>
            <Text style={styles.hello}>Hello,</Text>
            <Text style={styles.business} numberOfLines={2}>{profile.businessName}</Text>
            <View style={styles.chips}>
              {approved && <VerifiedBadge />}
              {profile.categories.map((c) => (
                <View key={c} style={styles.chip}><Text style={styles.chipText}>{categoryLabel(c)}</Text></View>
              ))}
            </View>
          </View>
        </View>

        {!approved && (
          <View style={[styles.statusPill, approved ? styles.pillOk : styles.pillWait]} testID="prov-status-pill">
            <Ionicons name={approved ? 'checkmark-circle' : 'time'} size={16} color={approved ? colors.successText : colors.warnText} />
            <Text style={[styles.pillText, { color: approved ? colors.successText : colors.warnText }]}>{statusWord}</Text>
          </View>
        )}

        <View ref={tour.ref('prov-wallet') as any} collapsable={false}>
          <WalletCard onPress={() => navigation.navigate('ProviderWallet')} />
        </View>

        <View style={styles.statRow}>
          <TouchableOpacity
            ref={tour.ref('prov-tile-0') as any}
            style={[styles.stat, counts.upcoming > 0 && styles.statHot]}
            onPress={() => navigation.navigate('ProviderBookings', { group: 'CONFIRMED' })}
            activeOpacity={0.88}
            testID="tile-Booking requests"
          >
            <View style={[styles.statIcon, { backgroundColor: colors.warnBg }]}><Ionicons name="mail-unread" size={20} color={colors.warnText} /></View>
            <Text style={styles.statNumber}>{counts.upcoming}</Text>
            <Text style={styles.statLabel}>Upcoming</Text>
            <Text style={styles.statHint}>Booked and paid</Text>
          </TouchableOpacity>
          <TouchableOpacity
            ref={tour.ref('prov-tile-1') as any}
            style={styles.stat}
            onPress={() => navigation.navigate('ProviderBookings', { group: 'COMPLETED' })}
            activeOpacity={0.88}
            testID="tile-Completed bookings"
          >
            <View style={[styles.statIcon, { backgroundColor: colors.successBg }]}><Ionicons name="checkmark-done" size={20} color={colors.successText} /></View>
            <Text style={styles.statNumber}>{counts.done}</Text>
            <Text style={styles.statLabel}>Completed</Text>
            <Text style={styles.statHint}>Jobs done</Text>
          </TouchableOpacity>
        </View>

        <ProviderStatusCard profile={profile} onChanged={setProfile} />

        {profile.payoutComplete === false && (
          <TouchableOpacity style={styles.payoutWarn} onPress={() => navigation.navigate('ProviderProfile')} activeOpacity={0.9} testID="payout-missing">
            <Ionicons name="wallet-outline" size={22} color={colors.danger} />
            <View style={{ flex: 1 }}>
              <Text style={styles.payoutWarnTitle}>Add your payment details</Text>
              <Text style={styles.payoutWarnText}>Customers cannot see or book you, and you cannot be approved, until you say where you get paid (UPI or bank account).</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.danger} />
          </TouchableOpacity>
        )}

        {!approved && (
          <Text style={styles.notice}>Customers cannot find or book you until you are approved.</Text>
        )}

        <Text style={styles.section}>Run your business</Text>
        <View style={styles.grid}>
          {manage.map((t) => (
            <TouchableOpacity
              key={t.id}
              ref={tour.ref(`prov-tile-${t.tour}`) as any}
              style={styles.tile}
              onPress={t.go}
              activeOpacity={0.85}
              testID={`tile-${t.title}`}
            >
              <View style={styles.tileIcon}><Ionicons name={t.icon} size={26} color={colors.primary} /></View>
              <Text style={styles.tileLabel} numberOfLines={2}>{t.title}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TakeTourButton />
      </KeyboardScroll>
    </View>
  );
};

const styles = themedStyles(() => ({
  page: { flex: 1, backgroundColor: colors.canvas },
  blob: { position: 'absolute', top: -130, left: -90, width: 360, height: 330, borderRadius: 180, backgroundColor: colors.mintDark, opacity: 0.55 },
  content: { padding: 22, paddingTop: 58, paddingBottom: 40 },
  topBar: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
  hello: { fontSize: 16, fontWeight: '600', color: colors.textSecondary },
  business: { fontSize: 28, fontWeight: '800', color: colors.ink, lineHeight: 33, marginTop: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  chip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.iconBorder },
  chipText: { fontSize: 11, fontWeight: '700', color: colors.text },
  round: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.iconBorder },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, marginBottom: 16 },
  pillOk: { backgroundColor: colors.successBg },
  pillWait: { backgroundColor: colors.warnBg },
  pillText: { fontSize: 12, fontWeight: '800' },
  statRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  stat: { flex: 1, backgroundColor: colors.card, borderRadius: 22, padding: 16, borderWidth: 1, borderColor: colors.border },
  statHot: { borderColor: colors.warnBorder },
  statIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  statNumber: { fontSize: 34, fontWeight: '800', color: colors.text, marginTop: 10 },
  statLabel: { fontSize: 14, fontWeight: '800', color: colors.text },
  statHint: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  section: { fontSize: 20, fontWeight: '800', color: colors.ink, marginTop: 8, marginBottom: 14 },
  grid: { flexDirection: 'row', marginBottom: 18 },
  tile: { width: '25%', alignItems: 'center', paddingHorizontal: 4 },
  tileIcon: { width: 62, height: 62, borderRadius: 20, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.iconBorder },
  tileLabel: { fontSize: 12, fontWeight: '700', color: colors.ink, marginTop: 8, textAlign: 'center' },
  payoutWarn: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.dangerBg, borderRadius: 14, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: colors.dangerBorder },
  payoutWarnTitle: { fontSize: 14, fontWeight: '800', color: colors.danger },
  payoutWarnText: { fontSize: 12, color: colors.text, marginTop: 2, lineHeight: 17 },
  setupTitle: { fontSize: 18, fontWeight: '800', color: colors.text, marginTop: 10 },
  setupText: { fontSize: 13, color: colors.textSecondary, lineHeight: 19, marginVertical: 10 },
  notice: { fontSize: 12, color: colors.textSecondary, marginBottom: 12, textAlign: 'center' },
}));
