import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { CompositeScreenProps, useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { shared } from '../../theme/shared';
import { customerApi, CustomerProfile } from '../../api/customerApi';
import { useAuth } from '../../context/AuthContext';
import { AppHeader } from '../../components/common/AppHeader';
import { KeyboardScroll } from '../../components/common/KeyboardScroll';
import { AppInput } from '../../components/common/AppInput';
import { LocationPicker } from '../../components/common/LocationPicker';
import { AppButton } from '../../components/common/AppButton';
import { LoadingView } from '../../components/common/LoadingView';
import { CustomerStackParamList, CustomerTabParamList } from '../../navigation/types';
import { confirmAction, getErrorMessage, notify } from '../../utils/helpers';

type Props = CompositeScreenProps<
  BottomTabScreenProps<CustomerTabParamList, 'Profile'>,
  NativeStackScreenProps<CustomerStackParamList>
>;

export const CustomerProfileScreen: React.FC<Props> = ({ navigation }) => {
  const { logout, updateUserData } = useAuth();
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

  const signOut = async () => {
    if (await confirmAction('Sign out', 'You will need to sign in again.', 'Sign out', true)) await logout();
  };

  if (!profile) return <LoadingView />;

  const Row: React.FC<{ icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }> = ({ icon, label, onPress }) => (
    <TouchableOpacity style={styles.menuRow} onPress={onPress}>
      <Ionicons name={icon} size={20} color={colors.primary} />
      <Text style={styles.menuText}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </TouchableOpacity>
  );

  return (
    <View style={shared.screen}>
      <AppHeader
        title="Profile"
        rightAction={{ icon: editing ? 'close' : 'create-outline', onPress: () => setEditing((v) => !v) }}
      />
      <KeyboardScroll contentContainerStyle={shared.content} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{profile.fullName.charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={styles.name}>{profile.fullName}</Text>
          <Text style={styles.email}>{profile.email}</Text>
        </View>

        {editing ? (
          <View style={shared.card}>
            <AppInput label="Full name" value={form.fullName} error={nameError} onChangeText={(v) => setForm({ ...form, fullName: v })} />
            <AppInput label="Phone" value={form.phone} keyboardType="phone-pad" onChangeText={(v) => setForm({ ...form, phone: v })} />
            <AppInput label="Address" value={form.address} onChangeText={(v) => setForm({ ...form, address: v })} />
            <LocationPicker
              value={{
                country: form.country, countryCode: form.countryCode, state: form.state, stateCode: form.stateCode,
                city: form.city, postalCode: form.postalCode, latitude: form.latitude, longitude: form.longitude,
              }}
              onChange={(l) => setForm((f) => ({ ...f, ...l }))}
              errors={cityError ? { city: cityError } : undefined}
            />
            <AppInput label="Emergency contact" value={form.emergencyContact} keyboardType="phone-pad" onChangeText={(v) => setForm({ ...form, emergencyContact: v })} />
            <AppButton title="Save Changes" onPress={save} loading={saving} />
          </View>
        ) : (
          <View style={shared.card}>
            {[
              ['Phone', profile.phone],
              ['Address', profile.address],
              ['Country', profile.country],
              ['State', profile.state],
              ['District / City', [profile.city, profile.postalCode].filter(Boolean).join(' ')],
              ['Location', profile.latitude != null ? 'GPS location saved' : 'City only (add GPS for distance-based results)'],
              ['Emergency contact', profile.emergencyContact],
            ].map(([label, value]) => (
              <View key={label} style={{ marginBottom: 10 }}>
                <Text style={shared.label}>{label}</Text>
                <Text style={shared.value}>{value || '-'}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={shared.card}>
          <Row icon="notifications-outline" label="Notifications" onPress={() => navigation.navigate('Notifications')} />
          <Row icon="help-circle-outline" label="Help & Support" onPress={() => navigation.navigate('HelpSupport')} />
        </View>

        <AppButton title="Sign Out" variant="outline" textStyle={{ color: colors.danger }} style={{ borderColor: colors.danger }} onPress={signOut} />
      </KeyboardScroll>
    </View>
  );
};

const styles = StyleSheet.create({
  hero: { alignItems: 'center', marginBottom: 18 },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 34, fontWeight: '800', color: '#FFFFFF' },
  name: { fontSize: 20, fontWeight: '800', color: colors.text, marginTop: 10 },
  email: { fontSize: 13, color: colors.textSecondary },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  menuText: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.text },
});
