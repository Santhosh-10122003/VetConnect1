import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { money } from '../../utils/helpers';
import { ClinicLocationCard } from '../../components/common/ClinicLocationCard';
import { doctorApi, DoctorProfile } from '../../api/doctorApi';
import { reviewApi, Review } from '../../api/reviewApi';
import { AppHeader } from '../../components/common/AppHeader';
import { AppButton } from '../../components/common/AppButton';
import { CustomerStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<CustomerStackParamList, 'DoctorProfile'>;

export const DoctorProfileScreen: React.FC<Props> = ({ navigation, route }) => {
  const { doctorId } = route.params;
  const [doctor, setDoctor] = useState<DoctorProfile | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [docRes, revRes] = await Promise.all([
          doctorApi.getDoctorById(doctorId),
          reviewApi.getDoctorReviews(doctorId),
        ]);
        if (docRes.data) setDoctor(docRes.data);
        if (revRes.data?.content) setReviews(revRes.data.content);
      } catch (e) {
        console.warn('Failed to load doctor profile', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [doctorId]);

  if (loading || !doctor) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AppHeader
        title="Doctor Profile"
        showBack
        onBack={() => navigation.goBack()}
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Doctor Header Banner */}
        <View style={styles.headerCard}>
          <Image
            source={{
              uri:
                doctor.avatarUrl ||
                'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&q=80&w=300',
            }}
            style={styles.avatar}
          />
          <View style={styles.nameRow}>
            <Text style={styles.name}>{doctor.fullName}</Text>
            {doctor.verificationStatus === 'APPROVED' && (
              <Ionicons name="checkmark-circle" size={20} color={colors.primary} style={{ marginLeft: 6 }} />
            )}
          </View>
          <Text style={styles.clinicName}>{doctor.clinicName}</Text>
          <Text style={styles.licenseText}>License: {doctor.licenseNumber}</Text>

          {/* Quick Metrics */}
          <View style={styles.metricsRow}>
            <View style={styles.metricItem}>
              <Text style={styles.metricValue}>{doctor.yearsOfExperience} yrs</Text>
              <Text style={styles.metricLabel}>Experience</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricItem}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <Ionicons name="star" size={16} color={colors.star} />
                <Text style={styles.metricValue}>
                  {doctor.ratingAvg > 0 ? doctor.ratingAvg.toFixed(1) : 'New'}
                </Text>
              </View>
              <Text style={styles.metricLabel}>{doctor.reviewCount} Reviews</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricItem}>
              <Text style={styles.metricValue}>{money(doctor.consultationFee)}</Text>
              <Text style={styles.metricLabel}>Consult Fee</Text>
            </View>
          </View>
        </View>

        {/* Clinic Location */}
        <View style={styles.cardSection}>
          <Text style={styles.sectionTitle}>Clinic Location</Text>
          <ClinicLocationCard
            clinicName={doctor.clinicName}
            address={doctor.clinicAddress}
            city={doctor.clinicCity}
            state={doctor.clinicState}
            country={doctor.clinicCountry}
            latitude={doctor.latitude}
            longitude={doctor.longitude}
          />
          {doctor.distanceKm != null && (
            <Text style={styles.locationAddress}>About {doctor.distanceKm < 1 ? 'less than 1' : doctor.distanceKm.toFixed(1)} km from you</Text>
          )}
        </View>

        {/* Specializations */}
        <View style={styles.cardSection}>
          <Text style={styles.sectionTitle}>Specializations</Text>
          <View style={styles.chipsContainer}>
            {doctor.specializations?.map((s) => (
              <View key={s.id} style={styles.specChip}>
                <Ionicons name="paw" size={14} color={colors.primary} />
                <Text style={styles.specChipText}>{s.name}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* About Doctor */}
        {doctor.bio && (
          <View style={styles.cardSection}>
            <Text style={styles.sectionTitle}>About</Text>
            <Text style={styles.bioText}>{doctor.bio}</Text>
          </View>
        )}

        {/* Patient Reviews */}
        <View style={styles.cardSection}>
          <View style={styles.reviewHeader}>
            <Text style={styles.sectionTitle}>Patient Reviews ({reviews.length})</Text>
          </View>

          {reviews.length === 0 ? (
            <Text style={styles.noReviewsText}>No reviews yet for this veterinarian.</Text>
          ) : (
            reviews.map((rev) => (
              <View key={rev.id} style={styles.reviewItem}>
                <View style={styles.reviewTop}>
                  <Text style={styles.reviewerName}>{rev.customerName}</Text>
                  <View style={styles.starsRow}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Ionicons
                        key={star}
                        name={star <= rev.rating ? 'star' : 'star-outline'}
                        size={14}
                        color={colors.star}
                      />
                    ))}
                  </View>
                </View>
                {rev.comment && <Text style={styles.reviewComment}>{rev.comment}</Text>}
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Floating Bottom Booking CTA */}
      <View style={styles.bottomBar}>
        <View>
          <Text style={styles.bottomFeeLabel}>Consultation Fee</Text>
          <Text style={styles.bottomFee}>{money(doctor.consultationFee)}</Text>
        </View>
        <AppButton
          title="Book Consultation"
          onPress={() => navigation.navigate('BookAppointment', { doctorId: doctor.id })}
          style={styles.bookBtn}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  headerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 3,
    borderColor: colors.mintBorder,
    marginBottom: 12,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  name: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
  },
  clinicName: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
  },
  licenseText: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    width: '100%',
    backgroundColor: colors.mint,
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 18,
    borderWidth: 1,
    borderColor: colors.mintBorder,
  },
  metricItem: {
    alignItems: 'center',
    flex: 1,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  metricLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  metricDivider: {
    width: 1,
    height: 30,
    backgroundColor: colors.mintDark,
  },
  cardSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  locationClinic: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  locationAddress: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  specChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.mint,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.mintBorder,
  },
  specChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  bioText: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 22,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  noReviewsText: {
    fontSize: 13,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  reviewItem: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 12,
    marginTop: 10,
  },
  reviewTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  reviewerName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 2,
  },
  reviewComment: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: 20,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 8,
  },
  bottomFeeLabel: {
    fontSize: 11,
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  bottomFee: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.primary,
  },
  bookBtn: {
    minWidth: 180,
  },
});
