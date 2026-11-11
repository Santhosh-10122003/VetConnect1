import React from 'react';
import { View, Text, Image, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { photoUri } from '../../api/petApi';
import { themedStyles, themedTable } from '../../theme/themed';

const TINTS = themedTable((): Record<string, string> => ({ DOG: colors.infoBg, CAT: colors.infoBg, BIRD: colors.successBg, RABBIT: colors.dangerBg, OTHER: colors.warnBg }));

/** The pet's photo, or (until they have one) a soft coloured circle with their first letter. */
export const PetAvatar: React.FC<{
  pet: { name: string; species: string; avatarUrl?: string | null };
  size?: number;
  /** Local photo just picked, shown before it is uploaded. */
  previewUri?: string;
  /** A little camera button on the corner: tap to change the photo. */
  onEdit?: () => void;
  square?: boolean;
  testID?: string;
}> = ({ pet, size = 64, previewUri, onEdit, square, testID }) => {
  const uri = previewUri ?? photoUri(pet.avatarUrl);
  const radius = square ? 0 : size / 2;
  const initial = (pet.name.trim().charAt(0) || '?').toUpperCase();
  return (
    <View style={{ width: size, height: size }} testID={testID}>
      {uri ? (
        <Image source={{ uri }} style={{ width: size, height: size, borderRadius: radius, backgroundColor: colors.mint }} />
      ) : (
        <View style={[styles.placeholder, { width: size, height: size, borderRadius: radius, backgroundColor: TINTS[pet.species] ?? TINTS.OTHER }]}>
          <Text style={[styles.initial, { fontSize: size * 0.42 }]}>{initial}</Text>
          <Ionicons name="paw" size={size * 0.2} color={colors.primaryLight} style={{ position: 'absolute', right: size * 0.14, bottom: size * 0.12 }} />
        </View>
      )}
      {onEdit && (
        <TouchableOpacity style={[styles.badge, { width: size * 0.34, height: size * 0.34, borderRadius: size * 0.17 }]} onPress={onEdit} activeOpacity={0.85} testID="pet-photo-edit" accessibilityLabel="Change photo">
          <Ionicons name="camera" size={size * 0.17} color="#FFFFFF" />
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = themedStyles(() => ({
  placeholder: { alignItems: 'center', justifyContent: 'center' },
  initial: { fontWeight: '800', color: colors.ink },
  badge: { position: 'absolute', right: -2, bottom: -2, backgroundColor: '#14171C', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#FFFFFF' },
}));
