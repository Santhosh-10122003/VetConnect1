import React, { useCallback, useState } from 'react';
import { TakeTourButton } from '../../tour/TakeTourButton';
import { AccountMenu } from '../../components/common/AccountMenu';
import { View, Text, TouchableOpacity } from 'react-native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { CompositeScreenProps, useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { shared } from '../../theme/shared';
import { customerApi, CustomerProfile } from '../../api/customerApi';
import { useAuth } from '../../context/AuthContext';
import { KeyboardScroll } from '../../components/common/KeyboardScroll';
import { AppInput } from '../../components/common/AppInput';
import { LocationPicker } from '../../components/common/LocationPicker';
import { AppButton } from '../../components/common/AppButton';
import { LoadingView } from '../../components/common/LoadingView';
import { ThemeToggle } from '../../components/common/ThemeToggle';
import { CustomerStackParamList, CustomerTabParamList } from '../../navigation/types';
import { confirmAction, getErrorMessage, notify, visibleEmail } from '../../utils/helpers';
import { themedStyles } from '../../theme/themed';
import { inputError } from '../../utils/inputRules';
import { useTopPad } from '../../utils/useTopPad';

type Props = CompositeScreenProps<
  BottomTabScreenProps<CustomerTabParamList, 'Profile'>,
  NativeStackScreenProps<CustomerStackParamList>
>;

type IconName = keyof typeof Ionicons.glyphMap;

export const CustomerProfileScreen: React.FC<Props> = ({ navigation }) => {
  const topPad = useTopPad(58);
  const { updateUserData } = useAuth();
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<{
    fullName: string; phone: string; address: string; city: string; postalCode: string;
    country: string; state: string; countryCode?: string; stateCode?: string;
    latitude?: number; longitude?: number; emergencyContact: string;
  }>({ fullName: '', phone: '', address: '', city: '', postalCode: '', country: '', state: '', emergencyContact: '' });
  const [cityError, setCityError] = useState('');
  const [nameError, setNameError] = useState('');

  const load = useCallback(async () => {
    try {
      const p = (await customerApi.getMyProfile()).data;
      setProfile(p);
      setForm({
        fullName: p.fullName ?? '',
        phone: p.phone ?? '',
        address: p.address ?? '',
        city: p.city ?? '',
        postalCode: p.postalCode ?? '',
        country: p.country ?? '',
        state: p.state ?? '',
        latitude: p.latitude ?? undefined,
        longitude: p.longitude ?? undefined,
        emergencyContact: p.emergencyContact ?? '',
      });
    } catch (e) {
      notify('Error', getErrorMessage(e));
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const save = async () => {
    if (!form.fullName.trim()) return setNameError('Full name is required');
    if (inputError('name', form.fullName)) return setNameError(inputError('name', form.fullName) as string);
    if (!form.city.trim()) return setCityError('City is required to find veterinarians near you');
    setNameError('');
    setCityError('');
    setSaving(true);
    try {
      const { countryCode, stateCode, ...payload } = form;
      const updated = (await customerApi.updateMyProfile({ ...payload, fullName: form.fullName.trim() })).data;
      setProfile(updated);
      updateUserData({ fullName: updated.fullName });
      setEditing(false);
    } catch (e) {
      notify('Could not save', getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  if (!profile) return <LoadingView />;

  const Info: React.FC<{ icon: IconName; label: string; value?: string | null; last?: boolean }> = ({ icon, label, value, last }) => (
    <View style={[styles.infoRow, !last && styles.infoDivider]}>
      <View style={styles.infoIcon}><Ionicons name={icon} size={18} color={colors.primary} /></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value || 'Not added'}</Text>
      </View>
    </View>
  );

  const Row: React.FC<{ icon: IconName; label: string; sub: string; onPress: () => void; last?: boolean }> = ({ icon, label, sub, onPress, last }) => (
    <TouchableOpacity style={[styles.menuRow, !last && styles.infoDivider]} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.menuIcon}><Ionicons name={icon} size={20} color={colors.primary} /></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.menuText}>{label}</Text>
        <Text style={styles.menuSub}>{sub}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </TouchableOpacity>
  );

  const place = [profile.city, profile.state].filter(Boolean).join(', ');

  return (
    <View style={styles.page}>
      <View style={styles.blob} pointerEvents="none" />
      <KeyboardScroll contentContainerStyle={[styles.content, { paddingTop: topPad }]} keyboardShouldPersistTaps="handled">
        <View style={styles.topBar}>
          <Text style={styles.title}>Profile</Text>
          <View style={styles.topButtons}>
            <ThemeToggle style={styles.round} />
            <AccountMenu style={styles.round} onEdit={() => setEditing((v) => !v)} editing={editing} />
          </View>
        </View>

        <View style={styles.hero}>
          <View style={styles.avatarRing}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{profile.fullName.charAt(0).toUpperCase()}</Text>
            </View>
          </View>
          <Text style={styles.name} numberOfLines={2}>{profile.fullName}</Text>
          <View style={styles.chips}>
            <View style={styles.chip}>
              <Ionicons name="call" size={13} color={colors.primary} />
              <Text style={styles.chipText}>{profile.phone || visibleEmail(profile.email) || 'No number'}</Text>
            </View>
            {!!place && (
              <View style={styles.chip}>
                <Ionicons name="location" size={13} color={colors.primary} />
                <Text style={styles.chipText} numberOfLines={1}>{place}</Text>
              </View>
            )}
          </View>
        </View>

        {editing ? (
          <View style={shared.card}>
            <AppInput kind="name" label="Full name" value={form.fullName} error={nameError} onChangeText={(v) => setForm({ ...form, fullName: v })} />
            <AppInput kind="phone" label="Phone" value={form.phone} keyboardType="phone-pad" onChangeText={(v) => setForm({ ...form, phone: v })} />
            <AppInput kind="address" label="Address" value={form.address} onChangeText={(v) => setForm({ ...form, address: v })} />
            <LocationPicker
              value={{
                country: form.country, countryCode: form.countryCode, state: form.state, stateCode: form.stateCode,
                city: form.city, postalCode: form.postalCode, latitude: form.latitude, longitude: form.longitude,
              }}
              onChange={(l) => setForm((f) => ({ ...f, ...l }))}
              errors={cityError ? { city: cityError } : undefined}
            />
            <AppInput kind="phone" label="Emergency contact" value={form.emergencyContact} keyboardType="phone-pad" onChangeText={(v) => setForm({ ...form, emergencyContact: v })} />
            <AppButton title="Save Changes" onPress={save} loading={saving} />
          </View>
        ) : (
          <>
            <Text style={styles.section}>My details</Text>
            <View style={styles.card}>
              <Info icon="call-outline" label="Phone" value={profile.phone} />
              <Info icon="home-outline" label="Address" value={profile.address} />
              <Info icon="map-outline" label="District / City" value={[profile.city, profile.postalCode].filter(Boolean).join(' ')} />
              <Info icon="earth-outline" label="State and country" value={[profile.state, profile.country].filter(Boolean).join(', ')} />
              <Info icon="navigate-outline" label="Location" value={profile.latitude != null ? 'GPS location saved' : 'City only (add GPS for distance-based results)'} />
              <Info icon="medkit-outline" label="Emergency contact" value={profile.emergencyContact} last />
            </View>
          </>
        )}

        <Text style={styles.section}>More</Text>
        <View style={styles.card}>
          <Row icon="search-outline" label="Find a pet's owner" sub="Scan a pet's QR code or type its number" onPress={() => navigation.navigate('FindPetOwner')} />
          <Row icon="notifications-outline" label="Notifications" sub="Booking updates and reminders" onPress={() => navigation.navigate('Notifications')} />
          <Row icon="help-circle-outline" label="Help & Support" sub="Questions about Jenni" onPress={() => navigation.navigate('HelpSupport')} last />
        </View>

        <TakeTourButton />
      </KeyboardScroll>
    </View>
  );
};

const styles = themedStyles(() => ({
  page: { flex: 1, backgroundColor: colors.canvas },
  blob: { position: 'absolute', top: -150, right: -110, width: 380, height: 360, borderRadius: 190, backgroundColor: colors.mintDark, opacity: 0.55 },
  content: { padding: 22, paddingTop: 58, paddingBottom: 40 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  title: { fontSize: 30, fontWeight: '800', color: colors.ink },
  topButtons: { flexDirection: 'row', gap: 8 },
  round: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.iconBorder },
  hero: { alignItems: 'center', marginBottom: 20 },
  avatarRing: { width: 108, height: 108, borderRadius: 54, borderWidth: 2, borderColor: colors.iconBorder, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card },
  avatar: { width: 92, height: 92, borderRadius: 46, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 38, fontWeight: '800', color: '#FFFFFF' },
  name: { fontSize: 24, fontWeight: '800', color: colors.ink, marginTop: 12, textAlign: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 10 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: 240, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.iconBorder },
  chipText: { fontSize: 12, fontWeight: '700', color: colors.text },
  section: { fontSize: 16, fontWeight: '800', color: colors.ink, marginBottom: 10, marginTop: 4 },
  card: { backgroundColor: colors.card, borderRadius: 22, paddingHorizontal: 14, borderWidth: 1, borderColor: colors.border, marginBottom: 18 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  infoDivider: { borderBottomWidth: 1, borderBottomColor: colors.border },
  infoIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
  infoLabel: { fontSize: 11, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4 },
  infoValue: { fontSize: 14, fontWeight: '600', color: colors.text, marginTop: 2 },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  menuIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
  menuText: { fontSize: 15, fontWeight: '700', color: colors.text },
  menuSub: { fontSize: 12, color: colors.textSecondary, marginTop: 1 },
}));
