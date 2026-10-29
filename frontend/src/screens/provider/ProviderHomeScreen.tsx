import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { shared } from '../../theme/shared';
import { careApi, Provider, categoryLabel } from '../../api/careApi';
import { useAuth } from '../../context/AuthContext';
import { AppHeader } from '../../components/common/AppHeader';
import { KeyboardScroll } from '../../components/common/KeyboardScroll';
import { AppButton } from '../../components/common/AppButton';
import { LoadingView } from '../../components/common/LoadingView';
import { WalletCard } from '../../components/payment/WalletCard';
import { ProviderStatusCard } from '../../components/care/ProviderStatusCard';
import { ProviderStackParamList } from '../../navigation/types';
import { confirmAction, getErrorMessage, notify } from '../../utils/helpers';

type Props = NativeStackScreenProps<ProviderStackParamList, 'ProviderHome'>;

export const ProviderHomeScreen: React.FC<Props> = ({ navigation }) => {
  const { user, logout } = useAuth();
  const isBusinessAccount = user?.role === 'ROLE_PROVIDER';
  const [profile, setProfile] = useState<Provider | null>(null);
  const [missing, setMissing] = useState(false);
  const [counts, setCounts] = useState({ requests: 0, confirmed: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const p = await careApi.myProfile();
      setProfile(p);
      setMissing(false);
      const [r, c] = await Promise.all([careApi.providerBookings('REQUESTED'), careApi.providerBookings('CONFIRMED')]);
      setCounts({ requests: r.totalElements, confirmed: c.totalElements });
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

  const signOut = async () => {
    if (await confirmAction('Sign out', 'You will need to sign in again.', 'Sign out', true)) await logout();
  };

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
              Add grooming, boarding or training to VetConnect. Pet owners nearby can book you and pay an advance, and you
              manage your menu, hours and requests here. An admin reviews your business first.
            </Text>
            <AppButton title="Set up my pet-care business" onPress={() => navigation.navigate('ProviderSetup')} />
          </View>
        </ScrollView>
      </View>
    );
  }

  const tiles: { icon: keyof typeof Ionicons.glyphMap; title: string; sub: string; badge?: number; go: () => void }[] = [
    { icon: 'mail-unread-outline', title: 'Booking requests', sub: 'Accept or decline new requests', badge: counts.requests, go: () => navigation.navigate('ProviderBookings', { group: 'REQUESTED' }) },
    { icon: 'calendar-outline', title: 'Confirmed bookings', sub: 'Upcoming work and completed jobs', badge: counts.confirmed, go: () => navigation.navigate('ProviderBookings', { group: 'CONFIRMED' }) },
    { icon: 'pricetags-outline', title: 'My services', sub: 'Menu, prices and extras', go: () => navigation.navigate('ProviderServices') },
    { icon: 'time-outline', title: 'Hours & capacity', sub: 'Opening hours, places, advance %', go: () => navigation.navigate('ProviderHours') },
    { icon: 'storefront-outline', title: 'Business profile', sub: 'Details, location and map pin', go: () => navigation.navigate('ProviderProfile') },
  ];

  return (
    <View style={shared.screen}>
      <AppHeader
        title={profile.businessName}
        subtitle={profile.categories.map(categoryLabel).join(' · ')}
        rightAction={isBusinessAccount ? { icon: 'log-out-outline', onPress: signOut } : undefined}
      />
      <KeyboardScroll
        contentContainerStyle={shared.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        <WalletCard onPress={() => navigation.navigate('ProviderWallet')} />

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

        {profile.verificationStatus !== 'APPROVED' && (
          <Text style={styles.notice}>Customers cannot find or book you until you are approved.</Text>
        )}

        {tiles.map((t) => (
          <TouchableOpacity key={t.title} style={[shared.card, styles.tile]} onPress={t.go} activeOpacity={0.85} testID={`tile-${t.title}`}>
            <View style={styles.tileIcon}><Ionicons name={t.icon} size={22} color={colors.primary} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.tileTitle}>{t.title}</Text>
              <Text style={styles.tileSub}>{t.sub}</Text>
            </View>
            {t.badge ? <View style={styles.badge}><Text style={styles.badgeText}>{t.badge}</Text></View> : null}
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        ))}

        {isBusinessAccount && (
          <AppButton title="Sign Out" variant="outline" textStyle={{ color: colors.danger }} style={{ borderColor: colors.danger, marginTop: 6 }} onPress={signOut} />
        )}
      </KeyboardScroll>
    </View>
  );
};

const styles = StyleSheet.create({
  payoutWarn: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FEF2F2', borderRadius: 14, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: '#FECACA' },
  payoutWarnTitle: { fontSize: 14, fontWeight: '800', color: colors.danger },
  payoutWarnText: { fontSize: 12, color: colors.text, marginTop: 2, lineHeight: 17 },
  setupTitle: { fontSize: 18, fontWeight: '800', color: colors.text, marginTop: 10 },
  setupText: { fontSize: 13, color: colors.textSecondary, lineHeight: 19, marginVertical: 10 },
  notice: { fontSize: 12, color: colors.textSecondary, marginBottom: 12, textAlign: 'center' },
  tile: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tileIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
  tileTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  tileSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  badge: { minWidth: 24, height: 24, borderRadius: 12, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  badgeText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
});
