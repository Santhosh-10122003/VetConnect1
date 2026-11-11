import React from 'react';
import { View, Text, Image, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { DoctorProfile } from '../../api/doctorApi';
import { drName, money } from '../../utils/helpers';
import { themedStyles } from '../../theme/themed';

interface DoctorCardProps {
  doctor: DoctorProfile;
  onPress: () => void;
  onBookPress?: () => void;
}

/** A small rounded fact with an icon: distance, rating, experience. */
const Fact: React.FC<{ icon: keyof typeof Ionicons.glyphMap; color?: string; bg?: string; children: React.ReactNode }> = ({ icon, color = colors.textSecondary, bg = colors.subtle, children }) => (
  <View style={[styles.fact, { backgroundColor: bg }]}>
    <Ionicons name={icon} size={13} color={color} />
    <Text style={[styles.factText, { color }]} numberOfLines={1}>{children}</Text>
  </View>
);

/** One vet in the list: who, where, how good, how much, and one clear button to book. */
export const DoctorCard: React.FC<DoctorCardProps> = ({ doctor, onPress, onBookPress }) => {
  const city = doctor.clinicCity || '';
  const place = city && !doctor.clinicAddress.toLowerCase().includes(city.toLowerCase())
    ? `${doctor.clinicAddress}, ${city}`
    : doctor.clinicAddress;
  const away = doctor.distanceKm !== undefined && doctor.distanceKm !== null
    ? (doctor.distanceKm < 1 ? 'Less than 1 km away' : `${doctor.distanceKm.toFixed(1)} km away`)
    : null;
  const years = doctor.yearsOfExperience;
  const treats = (doctor.specializations ?? []).slice(0, 3).map((s) => s.name).join(', ');

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.92} testID={`doctor-card-${doctor.id}`}>
      <View style={styles.topRow}>
        <Image
          source={{ uri: doctor.avatarUrl || 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&q=80&w=200' }}
          style={styles.avatar}
        />
        <View style={{ flex: 1 }}>
          <Text style={styles.name} numberOfLines={1}>{drName(doctor.fullName)}</Text>
          <Text style={styles.clinic} numberOfLines={1}>{doctor.clinicName}</Text>
          <View style={styles.placeRow}>
            <Ionicons name="location-outline" size={13} color={colors.textMuted} />
            <Text style={styles.place} numberOfLines={1}>{place}</Text>
          </View>
        </View>
      </View>

      <View style={styles.facts}>
        {doctor.verificationStatus === 'APPROVED' && <Fact icon="shield-checkmark" color={colors.successText} bg={colors.successBg}>Verified vet</Fact>}
        {away && <Fact icon="navigate" color={colors.primary} bg={colors.mint}>{away}</Fact>}
        <Fact icon="star" color={colors.warnText} bg={colors.warnBg}>
          {doctor.ratingAvg > 0 ? `${doctor.ratingAvg.toFixed(1)} (${doctor.reviewCount} ${doctor.reviewCount === 1 ? 'review' : 'reviews'})` : 'New, no reviews yet'}
        </Fact>
        {years > 0 && <Fact icon="ribbon-outline">{years} {years === 1 ? 'year' : 'years'} experience</Fact>}
      </View>

      {!!treats && <Text style={styles.treats} numberOfLines={1}>Treats: {treats}</Text>}

      <View style={styles.footer}>
        <View>
          <Text style={styles.feeLabel}>Vet fee</Text>
          <Text style={styles.fee}>{money(doctor.consultationFee)}</Text>
        </View>
        <TouchableOpacity style={styles.book} onPress={onBookPress || onPress} activeOpacity={0.85} testID={`book-doctor-${doctor.id}`}>
          <Text style={styles.bookText}>Book a visit</Text>
          <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
};

const styles = themedStyles(() => ({
  card: { backgroundColor: colors.card, borderRadius: 24, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: colors.border },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.mint },
  name: { fontSize: 18, fontWeight: '800', color: colors.text },
  clinic: { fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginTop: 1 },
  placeRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 3 },
  place: { flex: 1, fontSize: 12, color: colors.textMuted },
  verified: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', backgroundColor: colors.successBg, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  verifiedText: { fontSize: 11, fontWeight: '800', color: colors.successText },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  fact: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, maxWidth: '100%' },
  factText: { fontSize: 12, fontWeight: '700' },
  treats: { fontSize: 13, color: colors.textSecondary, marginTop: 12 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.border },
  feeLabel: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  fee: { fontSize: 22, fontWeight: '800', color: colors.text, marginTop: 1 },
  book: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.primary, paddingHorizontal: 20, paddingVertical: 13, borderRadius: 18 },
  bookText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
}));
