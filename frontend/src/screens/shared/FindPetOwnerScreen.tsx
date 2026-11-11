import React, { useEffect, useState } from 'react';
import { PetScanner } from '../../components/pet/PetScanner';
import { View, Text, TouchableOpacity, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { shared } from '../../theme/shared';
import { petApi, PetOwnerInfo } from '../../api/petApi';
import { AppHeader } from '../../components/common/AppHeader';
import { AppInput } from '../../components/common/AppInput';
import { AppButton } from '../../components/common/AppButton';
import { KeyboardScroll } from '../../components/common/KeyboardScroll';
import { PetAvatar } from '../../components/pet/PetAvatar';
import { getErrorMessage } from '../../utils/helpers';
import { themedStyles } from '../../theme/themed';

/** Found a pet? Type the number from its tag or its owner's app, and see how to reach the owner. */
export const FindPetOwnerScreen: React.FC<{ navigation: { goBack: () => void }; route?: { params?: { number?: string } } }> = ({ navigation, route }) => {
  const scanned = route?.params?.number;
  const [number, setNumber] = useState(scanned ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [found, setFound] = useState<PetOwnerInfo | null>(null);
  const [scanning, setScanning] = useState(false);

  const digits = number.replace(/\D/g, '');

  const search = async (override?: string) => {
    const d = override ?? digits;
    if (d.length !== 15) return setError('The pet ID number has 15 digits.');
    setBusy(true);
    setError(null);
    setFound(null);
    try {
      setFound(await petApi.findOwner(d));
    } catch (e) {
      setError(getErrorMessage(e, 'Could not look that up.'));
    } finally {
      setBusy(false);
    }
  };

  // opened by scanning a pet's QR code: look the owner up straight away
  useEffect(() => {
    if (scanned && /^\d{15}$/.test(scanned)) { setNumber(scanned); search(scanned); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanned]);

  return (
    <View style={shared.screen}>
      <AppHeader title="Find a pet's owner" showBack onBack={() => navigation.goBack()} />
      <KeyboardScroll contentContainerStyle={shared.content} keyboardShouldPersistTaps="handled">
        <View style={styles.intro}>
          <Ionicons name="search-circle" size={34} color={colors.primary} />
          <Text style={styles.introText}>
            Found a pet? Enter its 15-digit ID number to see who to call. The owner is told when their pet's number is looked up.
          </Text>
        </View>

        <TouchableOpacity style={styles.scan} onPress={() => setScanning(true)} activeOpacity={0.85} testID="find-owner-scan">
          <Ionicons name="qr-code" size={22} color="#FFFFFF" />
          <Text style={styles.scanText}>Scan the pet's QR code</Text>
        </TouchableOpacity>
        <Text style={styles.or}>or type the number</Text>

        <AppInput
          label="Pet ID number"
          placeholder="15 digits"
          value={number}
          onChangeText={(v) => { setNumber(v.replace(/[^\d\s-]/g, '')); setError(null); }}
          keyboardType="number-pad"
          icon="finger-print-outline"
          maxLength={21}
          error={error ?? undefined}
          testID="find-owner-number"
        />
        <AppButton title="Find the owner" onPress={() => search()} loading={busy} testID="find-owner-search" />

        {found && (
          <View style={styles.card} testID="find-owner-result">
            <View style={styles.petRow}>
              <PetAvatar pet={{ name: found.petName, species: found.species ?? 'OTHER', avatarUrl: found.avatarUrl }} size={58} />
              <View style={{ flex: 1 }}>
                <Text style={styles.petName}>{found.petName}</Text>
                <Text style={styles.petSub}>{found.breed || (found.species ? found.species.charAt(0) + found.species.slice(1).toLowerCase() : '')}</Text>
              </View>
            </View>

            <Text style={styles.label}>Owner</Text>
            <Text style={styles.value} testID="owner-name">{found.ownerName}</Text>

            <Text style={styles.label}>Mobile number</Text>
            <Text style={styles.value} testID="owner-phone">{found.ownerPhone || 'Not given'}</Text>

            <Text style={styles.label}>Address</Text>
            <Text style={styles.value} testID="owner-address">{found.ownerAddress || 'Not given'}</Text>

            {!!found.ownerPhone && (
              <TouchableOpacity style={styles.call} onPress={() => Linking.openURL(`tel:${found.ownerPhone}`)} activeOpacity={0.85} testID="owner-call">
                <Ionicons name="call" size={18} color="#FFFFFF" />
                <Text style={styles.callText}>Call {found.ownerName.split(' ')[0]}</Text>
              </TouchableOpacity>
            )}
            <Text style={styles.note}>Please use this only to return the pet to its owner.</Text>
          </View>
        )}
      </KeyboardScroll>

      <PetScanner visible={scanning} onClose={() => setScanning(false)} onFound={(n) => { setScanning(false); setNumber(n); search(n); }} />
    </View>
  );
};

const styles = themedStyles(() => ({
  scan: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: colors.primary, borderRadius: 18, paddingVertical: 16, marginBottom: 12 },
  scanText: { color: '#FFFFFF', fontWeight: '800', fontSize: 16 },
  or: { textAlign: 'center', fontSize: 12, color: colors.textMuted, fontWeight: '700', marginBottom: 14 },
  intro: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.mint, borderRadius: 18, padding: 14, marginBottom: 18, borderWidth: 1, borderColor: colors.mintDark },
  introText: { flex: 1, fontSize: 13, color: colors.textSecondary, lineHeight: 19 },
  card: { marginTop: 18, backgroundColor: colors.card, borderRadius: 22, borderWidth: 1, borderColor: colors.border, padding: 18 },
  petRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 6 },
  petName: { fontSize: 20, fontWeight: '800', color: colors.text },
  petSub: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  label: { fontSize: 12, fontWeight: '700', color: colors.textMuted, marginTop: 14 },
  value: { fontSize: 16, fontWeight: '700', color: colors.text, marginTop: 3, lineHeight: 22 },
  call: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#14171C', borderRadius: 16, paddingVertical: 13, marginTop: 18 },
  callText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
  note: { fontSize: 11, color: colors.textMuted, textAlign: 'center', marginTop: 12 },
}));
