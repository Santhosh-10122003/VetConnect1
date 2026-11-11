import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Linking, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { petApi, PetOwnerInfo } from '../../api/petApi';
import { PetAvatar } from '../../components/pet/PetAvatar';
import { getErrorMessage } from '../../utils/helpers';
import { themedStyles } from '../../theme/themed';

/**
 * What a pet's QR code opens. Anyone can see it, no account needed, and it shows only the pet and how to reach its
 * owner: nothing else of the app is shown.
 */
export const PetFoundScreen: React.FC<{ number: string; onClose: () => void }> = ({ number, onClose }) => {
  const [found, setFound] = useState<PetOwnerInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let off = false;
    setFound(null);
    setError(null);
    petApi.scan(number).then((r) => { if (!off) setFound(r); }).catch((e) => { if (!off) setError(getErrorMessage(e, 'Could not look that up.')); });
    return () => { off = true; };
  }, [number]);

  return (
    <View style={styles.screen} testID="pet-found">
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.badge}><Ionicons name="paw" size={26} color="#FFFFFF" /></View>
        <Text style={styles.title}>{found ? `You found ${found.petName}` : error ? 'We could not find this pet' : 'Finding the owner...'}</Text>
        <Text style={styles.lead}>{found ? 'Thank you for helping. Please contact the owner so this pet can get home.' : error ?? ' '}</Text>

        {!found && !error && <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />}

        {found && (
          <View style={styles.card} testID="find-owner-result">
            <View style={styles.petRow}>
              <PetAvatar pet={{ name: found.petName, species: found.species ?? 'OTHER', avatarUrl: found.avatarUrl }} size={64} />
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
          </View>
        )}

        <TouchableOpacity onPress={onClose} style={styles.close} testID="pet-found-close">
          <Text style={styles.closeText}>{found ? 'Done' : 'Close'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = themedStyles(() => ({
  screen: { flex: 1, backgroundColor: colors.page },
  content: { padding: 24, paddingTop: 64, alignItems: 'center', flexGrow: 1 },
  badge: { width: 58, height: 58, borderRadius: 29, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 26, fontWeight: '800', color: colors.text, textAlign: 'center', marginTop: 16, letterSpacing: -0.5 },
  lead: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginTop: 8, lineHeight: 20, maxWidth: 320 },
  card: { alignSelf: 'stretch', marginTop: 24, backgroundColor: colors.card, borderRadius: 24, borderWidth: 1, borderColor: colors.border, padding: 20 },
  petRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 6 },
  petName: { fontSize: 22, fontWeight: '800', color: colors.text },
  petSub: { fontSize: 14, color: colors.textSecondary, marginTop: 2 },
  label: { fontSize: 12, fontWeight: '700', color: colors.textMuted, marginTop: 16 },
  value: { fontSize: 17, fontWeight: '700', color: colors.text, marginTop: 3, lineHeight: 23 },
  call: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#14171C', borderRadius: 18, paddingVertical: 15, marginTop: 22 },
  callText: { color: '#FFFFFF', fontWeight: '800', fontSize: 16 },
  close: { marginTop: 22, paddingVertical: 12, paddingHorizontal: 24 },
  closeText: { fontSize: 15, fontWeight: '700', color: colors.primaryLight },
}));
