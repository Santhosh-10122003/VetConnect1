import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IconText } from '../common/IconText';
import { colors } from '../../theme/colors';
import { Pet } from '../../api/petApi';

interface PetCardProps {
  pet: Pet;
  onPress: () => void;
  selected?: boolean;
}

export const PetCard: React.FC<PetCardProps> = ({ pet, onPress, selected = false }) => {
  const getSpeciesIcon = (species: string): keyof typeof Ionicons.glyphMap => {
    switch (species.toUpperCase()) {
      case 'DOG':
        return 'paw';
      case 'CAT':
        return 'logo-octocat';
      case 'BIRD':
        return 'logo-twitter';
      default:
        return 'heart-outline';
    }
  };

  const getAgeString = (dobString?: string) => {
    if (!dobString) return 'Age unknown';
    const dob = new Date(dobString);
    const diffMs = Date.now() - dob.getTime();
    const ageYears = Math.floor(diffMs / (1000 * 60 * 60 * 24 * 365.25));
    if (ageYears < 1) {
      const ageMonths = Math.floor(diffMs / (1000 * 60 * 60 * 24 * 30.4));
      return `${ageMonths} months old`;
    }
    return `${ageYears} ${ageYears === 1 ? 'yr' : 'yrs'} old`;
  };

  return (
    <TouchableOpacity
      style={[styles.card, selected && styles.selectedCard]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={styles.imageContainer}>
        {pet.avatarUrl ? (
          <Image source={{ uri: pet.avatarUrl }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Ionicons name={getSpeciesIcon(pet.species)} size={32} color={colors.primary} />
          </View>
        )}
      </View>

      <View style={styles.info}>
        <View style={styles.headerRow}>
          <Text style={styles.name} numberOfLines={1}>{pet.name}</Text>
          <View style={styles.genderTag}>
            <Text style={styles.genderText}>{pet.gender.toUpperCase()}</Text>
          </View>
        </View>

        <Text style={styles.speciesBreed}>
          {pet.breed ? `${pet.breed} • ${pet.species}` : pet.species}
        </Text>

        <View style={styles.statsRow}>
          <IconText icon="time-outline" iconColor={colors.textSecondary} textStyle={styles.statText}>{getAgeString(pet.dateOfBirth)}</IconText>
          {pet.weight && (
            <IconText icon="fitness-outline" iconColor={colors.textSecondary} textStyle={styles.statText}>{pet.weight} kg</IconText>
          )}
        </View>

        {pet.allergies && (
          <View style={styles.alertRow}>
            <Ionicons name="warning-outline" size={12} color="#DC2626" />
            <Text style={styles.alertText} numberOfLines={1}>
              Allergies: {pet.allergies}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.chevron}>
        <Ionicons
          name={selected ? 'checkmark-circle' : 'chevron-forward'}
          size={22}
          color={selected ? colors.primary : colors.textMuted}
        />
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: colors.border,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 2,
  },
  selectedCard: {
    borderColor: colors.primary,
    backgroundColor: '#EFF6FF',
  },
  imageContainer: {
    marginRight: 14,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: colors.mintBorder,
  },
  avatarPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.mint,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.mintBorder,
  },
  info: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  genderTag: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  genderText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  speciesBreed: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 6,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  alertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  alertText: {
    fontSize: 11,
    color: '#DC2626',
    fontWeight: '500',
  },
  chevron: {
    marginLeft: 10,
  },
});
