import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { DoctorProfile } from '../../api/doctorApi';
import { IconText } from '../common/IconText';
import { money } from '../../utils/helpers';

interface DoctorCardProps {
  doctor: DoctorProfile;
  onPress: () => void;
  onBookPress?: () => void;
}

export const DoctorCard: React.FC<DoctorCardProps> = ({ doctor, onPress, onBookPress }) => {
  // Show the city unless the street address already mentions it.
  const city = doctor.clinicCity || '';
  const place = city && !doctor.clinicAddress.toLowerCase().includes(city.toLowerCase())
    ? `${doctor.clinicAddress}, ${city}`
    : doctor.clinicAddress;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.9}>
      <View style={styles.topRow}>
        <Image
          source={{
            uri:
              doctor.avatarUrl ||
              'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&q=80&w=200',
          }}
          style={styles.avatar}
        />
        <View style={styles.infoCol}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>{doctor.fullName}</Text>
            {doctor.verificationStatus === 'APPROVED' && (
              <Ionicons name="checkmark-circle" size={18} color={colors.primary} style={styles.verifiedIcon} />
            )}
          </View>
          <IconText icon="business-outline" iconColor={colors.textSecondary} textStyle={styles.clinic} numberOfLines={1} style={styles.line}>{doctor.clinicName}</IconText>
          <IconText icon="location-outline" iconColor={colors.textMuted} textStyle={styles.address} numberOfLines={1} style={styles.line}>{place}</IconText>

          <View style={styles.metaRow}>
            <View style={styles.ratingBadge}>
              <Ionicons name="star" size={13} color={colors.star} />
              <Text style={styles.ratingText}>
                {doctor.ratingAvg > 0 ? doctor.ratingAvg.toFixed(1) : 'New'}
              </Text>
              <Text style={styles.reviewCount}>({doctor.reviewCount})</Text>
            </View>
            <Text style={styles.expText}>{doctor.yearsOfExperience} yrs exp</Text>
          </View>
          {doctor.distanceKm !== undefined && doctor.distanceKm !== null && (
            <IconText icon="navigate-outline" size={12} iconColor={colors.primary} textStyle={[styles.expText, { color: colors.primary }]} style={styles.distanceRow}>
              {doctor.distanceKm < 1 ? '< 1' : doctor.distanceKm.toFixed(1)} km away
            </IconText>
          )}
        </View>
      </View>

      {doctor.specializations && doctor.specializations.length > 0 && (
        <View style={styles.chipsRow}>
          {doctor.specializations.slice(0, 2).map((s) => (
            <View key={s.id} style={styles.chip}>
              <Text style={styles.chipText}>{s.name}</Text>
            </View>
          ))}
          {doctor.specializations.length > 2 && (
            <View style={styles.chipMore}>
              <Text style={styles.chipMoreText}>+{doctor.specializations.length - 2} more</Text>
            </View>
          )}
        </View>
      )}

      <View style={styles.footerRow}>
        <View>
          <Text style={styles.feeLabel}>Consultation Fee</Text>
          <Text style={styles.feeValue}>{money(doctor.consultationFee)}</Text>
        </View>
        <TouchableOpacity
          style={styles.bookButton}
          onPress={onBookPress || onPress}
          activeOpacity={0.8}
        >
          <Text style={styles.bookButtonText}>Book Now</Text>
          <Ionicons name="calendar-outline" size={15} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  topRow: {
    flexDirection: 'row',
  },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.mint,
    borderWidth: 2,
    borderColor: colors.mintBorder,
  },
  infoCol: {
    flex: 1,
    marginLeft: 14,
    justifyContent: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    flex: 1,
  },
  verifiedIcon: {
    marginLeft: 4,
  },
  clinic: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  address: {
    fontSize: 12,
    color: colors.textMuted,
  },
  line: {
    marginTop: 2,
  },
  distanceRow: {
    marginTop: 6,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginTop: 6,
    columnGap: 12,
    rowGap: 4,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#92400E',
  },
  reviewCount: {
    fontSize: 11,
    color: '#B45309',
  },
  expText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
    gap: 6,
  },
  chip: {
    backgroundColor: colors.mint,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.mintBorder,
  },
  chipText: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: '600',
  },
  chipMore: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  chipMoreText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  feeLabel: {
    fontSize: 11,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  feeValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary,
    marginTop: 1,
  },
  bookButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  bookButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
});
