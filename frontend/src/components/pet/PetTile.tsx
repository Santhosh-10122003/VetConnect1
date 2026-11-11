import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { colors } from '../../theme/colors';
import { Pet, photoUri } from '../../api/petApi';
import { petAge } from '../../utils/helpers';
import { themedStyles, themedTable } from '../../theme/themed';

export const SPECIES_LABEL: Record<string, string> = { DOG: 'Dog', CAT: 'Cat', BIRD: 'Bird', RABBIT: 'Rabbit', OTHER: 'Pet' };
const SPECIES_ICON: Record<string, keyof typeof Ionicons.glyphMap> = { DOG: 'paw', CAT: 'paw', BIRD: 'leaf', RABBIT: 'paw', OTHER: 'paw' };
const TINTS = themedTable((): Record<string, string> => ({ DOG: colors.infoBg, CAT: colors.infoBg, BIRD: colors.successBg, RABBIT: colors.dangerBg, OTHER: colors.warnBg }));

/** One pet as a big photo tile: the name sits on the photo, with the breed, age and a few badges. */
export const PetTile: React.FC<{ pet: Pet; onPress: () => void }> = ({ pet, onPress }) => {
  const uri = photoUri(pet.avatarUrl);
  const age = pet.dateOfBirth ? petAge(pet.dateOfBirth) : null;
  const gender = pet.gender === 'MALE' ? 'male' : pet.gender === 'FEMALE' ? 'female' : null;
  return (
    <TouchableOpacity style={styles.tile} onPress={onPress} activeOpacity={0.9} testID={`pet-tile-${pet.id}`}>
      <View style={[styles.photo, { backgroundColor: TINTS[pet.species] ?? TINTS.OTHER }]}>
        {uri ? (
          <Image source={{ uri }} style={StyleSheet.absoluteFill as any} resizeMode="cover" />
        ) : (
          <>
            <Text style={styles.initial}>{(pet.name.trim().charAt(0) || '?').toUpperCase()}</Text>
            <Ionicons name={SPECIES_ICON[pet.species] ?? 'paw'} size={22} color={colors.primaryLight} style={styles.paw} />
          </>
        )}

        <View style={styles.badgesTop}>
          {!!pet.allergies ? (
            <View style={styles.flag}><Ionicons name="warning" size={11} color="#FFFFFF" /><Text style={styles.flagText}>Allergies</Text></View>
          ) : <View />}
          {gender && (
            <View style={styles.gender}>
              <Ionicons name={gender} size={14} color="#FFFFFF" />
            </View>
          )}
        </View>

        {/* a soft fade to dark at the bottom, so the name reads on any photo */}
        <Svg style={styles.scrim} width="100%" height="100%" preserveAspectRatio="none" pointerEvents="none">
          <Defs>
            <LinearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#000000" stopOpacity="0" />
              <Stop offset="1" stopColor="#000000" stopOpacity="0.72" />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#fade)" />
        </Svg>
        <View style={styles.band}>
          <Text style={styles.name} numberOfLines={1}>{pet.name}</Text>
          <Text style={styles.sub} numberOfLines={1}>{pet.breed || SPECIES_LABEL[pet.species] || 'Pet'}</Text>
        </View>
      </View>

      <View style={styles.facts}>
        <View style={styles.fact}>
          <Ionicons name="calendar-outline" size={13} color={colors.textSecondary} />
          <Text style={styles.factText} numberOfLines={1}>{age ?? 'Age not added'}</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
      </View>
    </TouchableOpacity>
  );
};

/** The last tile: tap it to add another pet. */
export const AddPetTile: React.FC<{ onPress: () => void; first?: boolean }> = ({ onPress, first }) => (
  <TouchableOpacity style={[styles.tile, styles.add]} onPress={onPress} activeOpacity={0.85} testID="add-pet-tile">
    <View style={styles.plus}><Ionicons name="add" size={30} color="#FFFFFF" /></View>
    <Text style={styles.addText}>{first ? 'Add your first pet' : 'Add a pet'}</Text>
    <Text style={styles.addSub}>Name, photo and a QR code</Text>
  </TouchableOpacity>
);

const styles = themedStyles(() => ({
  tile: { flex: 1, backgroundColor: colors.card, borderRadius: 26, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', marginBottom: 14 },
  photo: { width: '100%', aspectRatio: 0.92, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  initial: { fontSize: 72, fontWeight: '800', color: colors.ink, marginBottom: 34 },
  paw: { position: 'absolute', right: 14, top: 52 },
  badgesTop: { position: 'absolute', left: 10, right: 10, top: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  flag: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#DC2626', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  flagText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
  gender: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(20,23,28,0.55)', alignItems: 'center', justifyContent: 'center' },
  scrim: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 96 },
  band: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 12, paddingBottom: 10 },
  name: { fontSize: 18, fontWeight: '800', color: '#FFFFFF' },
  sub: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.85)', marginTop: 1 },
  facts: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 10 },
  fact: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  factText: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  add: { alignItems: 'center', justifyContent: 'center', borderStyle: 'dashed', borderWidth: 2, borderColor: colors.mintDark, backgroundColor: colors.mint, minHeight: 230 },
  plus: { width: 58, height: 58, borderRadius: 29, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  addText: { marginTop: 12, fontSize: 15, fontWeight: '800', color: colors.ink, textAlign: 'center', paddingHorizontal: 8 },
  addSub: { marginTop: 3, fontSize: 11, color: colors.textSecondary, textAlign: 'center', paddingHorizontal: 10 },
}));
