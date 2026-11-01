import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

interface Props {
  type: 'home' | 'doctors' | 'appointments' | 'care' | 'pets' | 'profile' | 'doctor_dash' | 'provider_home';
}

export const ScreenGuideMockup: React.FC<Props> = ({ type }) => {
  switch (type) {
    case 'home':
      return (
        <View style={styles.cardBox}>
          <View style={styles.mockHeader}>
            <View>
              <Text style={styles.mockSub}>Welcome Pet Parent,</Text>
              <Text style={styles.mockTitle}>What are you looking for?</Text>
            </View>
            <Ionicons name="notifications-outline" size={18} color={colors.primary} />
          </View>
          <View style={styles.mockGrid}>
            <View style={styles.mockTile}>
              <Ionicons name="medkit-outline" size={16} color={colors.primary} />
              <Text style={styles.mockTileText}>Vet</Text>
            </View>
            <View style={styles.mockTile}>
              <Ionicons name="cut-outline" size={16} color={colors.primary} />
              <Text style={styles.mockTileText}>Grooming</Text>
            </View>
            <View style={styles.mockTile}>
              <Ionicons name="bed-outline" size={16} color={colors.primary} />
              <Text style={styles.mockTileText}>Boarding</Text>
            </View>
            <View style={styles.mockTile}>
              <Ionicons name="paw-outline" size={16} color={colors.primary} />
              <Text style={styles.mockTileText}>Pets</Text>
            </View>
          </View>
          <View style={styles.mockUpcoming}>
            <View style={{ flex: 1 }}>
              <Text style={styles.mockUpTitle}>Next Visit: Dr. Sarah</Text>
              <Text style={styles.mockUpSub}>Tomorrow at 10:30 AM</Text>
            </View>
            <View style={styles.badgeConfirmed}>
              <Text style={styles.badgeText}>CONFIRMED</Text>
            </View>
          </View>
        </View>
      );

    case 'doctors':
      return (
        <View style={styles.cardBox}>
          <View style={styles.mockSearchBar}>
            <Ionicons name="search" size={14} color={colors.textSecondary} />
            <Text style={styles.mockSearchText}>Search clinic, specialty, or doctor...</Text>
          </View>
          <View style={styles.mockDoctorCard}>
            <View style={styles.mockDoctorAvatar}>
              <Ionicons name="person" size={18} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.mockDocName}>Dr. Sarah • Paws Clinic</Text>
              <Text style={styles.mockDocSub}>Vet Physician • 8 yrs exp • ★ 4.9</Text>
              <View style={styles.mockTagRow}>
                <View style={styles.mockTag}>
                  <Ionicons name="navigate-outline" size={11} color={colors.primary} />
                  <Text style={styles.mockTagText}>2.4 km away</Text>
                </View>
                <View style={styles.mockTag}>
                  <Text style={styles.mockTagText}>50% Advance</Text>
                </View>
              </View>
            </View>
          </View>
        </View>
      );

    case 'appointments':
      return (
        <View style={styles.cardBox}>
          <View style={styles.mockTabBar}>
            <View style={[styles.mockTabChip, styles.mockTabChipActive]}>
              <Text style={[styles.mockTabChipText, { color: '#FFFFFF' }]}>UPCOMING (1)</Text>
            </View>
            <View style={styles.mockTabChip}>
              <Text style={styles.mockTabChipText}>COMPLETED</Text>
            </View>
            <View style={styles.mockTabChip}>
              <Text style={styles.mockTabChipText}>CANCELLED</Text>
            </View>
          </View>
          <View style={styles.mockDoctorCard}>
            <View style={{ flex: 1 }}>
              <View style={styles.rowBetween}>
                <Text style={styles.mockDocName}>Annual Health Checkup</Text>
                <View style={styles.badgeConfirmed}><Text style={styles.badgeText}>CONFIRMED</Text></View>
              </View>
              <Text style={styles.mockDocSub}>Dr. Sarah • Bella (Golden Retriever)</Text>
              <Text style={styles.mockDateText}>📅 Oct 15, 10:30 AM • 50% Advance Paid</Text>
              <View style={styles.mockActionRow}>
                <Text style={styles.mockActionBtn}>Reschedule</Text>
                <Text style={styles.mockActionBtn}>View Notes</Text>
              </View>
            </View>
          </View>
        </View>
      );

    case 'care':
      return (
        <View style={styles.cardBox}>
          <View style={styles.mockTabBar}>
            <View style={[styles.mockTabChip, styles.mockTabChipActive]}>
              <Text style={[styles.mockTabChipText, { color: '#FFFFFF' }]}>Grooming</Text>
            </View>
            <View style={styles.mockTabChip}>
              <Text style={styles.mockTabChipText}>Boarding</Text>
            </View>
            <View style={styles.mockTabChip}>
              <Text style={styles.mockTabChipText}>Training</Text>
            </View>
          </View>
          <View style={styles.mockDoctorCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.mockDocName}>Paws & Claws Pet Spa</Text>
              <Text style={styles.mockDocSub}>Full Grooming, Bath & Nail Trimming</Text>
              <View style={styles.mockTagRow}>
                <View style={styles.mockTag}><Text style={styles.mockTagText}>Small ≤ 7kg</Text></View>
                <View style={styles.mockTag}><Text style={styles.mockTagText}>Medium ≤ 20kg</Text></View>
                <View style={styles.mockTag}><Text style={styles.mockTagText}>Large ≤ 35kg</Text></View>
              </View>
            </View>
          </View>
        </View>
      );

    case 'pets':
      return (
        <View style={styles.cardBox}>
          <View style={styles.mockDoctorCard}>
            <View style={[styles.mockDoctorAvatar, { backgroundColor: colors.warning }]}>
              <Ionicons name="paw" size={18} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.mockDocName}>Bella</Text>
              <Text style={styles.mockDocSub}>Golden Retriever • Female • 2 years</Text>
              <View style={styles.mockTagRow}>
                <View style={[styles.mockTag, { backgroundColor: '#DCFCE7' }]}>
                  <Text style={[styles.mockTagText, { color: '#166534' }]}>✓ Vaccines Up to Date</Text>
                </View>
              </View>
            </View>
          </View>
          <View style={styles.mockAddBtn}>
            <Ionicons name="add-circle-outline" size={15} color={colors.primary} />
            <Text style={styles.mockAddBtnText}>+ Add Another Pet</Text>
          </View>
        </View>
      );

    case 'profile':
      return (
        <View style={styles.cardBox}>
          <View style={styles.mockHeader}>
            <View style={[styles.mockDoctorAvatar, { width: 36, height: 36 }]}>
              <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 16 }}>P</Text>
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.mockDocName}>Pet Parent Account</Text>
              <Text style={styles.mockDocSub}>+91 98765 43210</Text>
            </View>
          </View>
          <View style={styles.mockRowInfo}>
            <Ionicons name="location-outline" size={15} color={colors.primary} />
            <Text style={styles.mockRowText}>GPS Location Pinned (Accurate Distance)</Text>
          </View>
          <View style={styles.mockRowInfo}>
            <Ionicons name="call-outline" size={15} color={colors.danger} />
            <Text style={styles.mockRowText}>24x7 Emergency Helplines Available</Text>
          </View>
        </View>
      );

    case 'doctor_dash':
      return (
        <View style={styles.cardBox}>
          <View style={styles.mockGrid}>
            <View style={styles.mockTile}>
              <Text style={styles.mockStatNum}>4</Text>
              <Text style={styles.mockTileText}>Today</Text>
            </View>
            <View style={styles.mockTile}>
              <Text style={styles.mockStatNum}>12</Text>
              <Text style={styles.mockTileText}>This Week</Text>
            </View>
            <View style={styles.mockTile}>
              <Text style={styles.mockStatNum}>₹2,400</Text>
              <Text style={styles.mockTileText}>Advance</Text>
            </View>
          </View>
          <View style={styles.mockUpcoming}>
            <Text style={styles.mockDocName}>Next: Bella with Alex (10:00 AM)</Text>
          </View>
        </View>
      );

    case 'provider_home':
      return (
        <View style={styles.cardBox}>
          <View style={styles.mockGrid}>
            <View style={styles.mockTile}>
              <Text style={styles.mockStatNum}>3</Text>
              <Text style={styles.mockTileText}>Grooming</Text>
            </View>
            <View style={styles.mockTile}>
              <Text style={styles.mockStatNum}>2</Text>
              <Text style={styles.mockTileText}>Boarding</Text>
            </View>
            <View style={styles.mockTile}>
              <Text style={styles.mockStatNum}>85%</Text>
              <Text style={styles.mockTileText}>Capacity</Text>
            </View>
          </View>
        </View>
      );

    default:
      return null;
  }
};

const styles = StyleSheet.create({
  cardBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    marginVertical: 10,
  },
  mockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  mockTitle: { fontSize: 13, fontWeight: '700', color: colors.text },
  mockSub: { fontSize: 11, color: colors.textSecondary },
  mockGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
    marginBottom: 8,
  },
  mockTile: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 3,
  },
  mockTileText: { fontSize: 10, fontWeight: '600', color: colors.text },
  mockUpcoming: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  mockUpTitle: { fontSize: 11, fontWeight: '700', color: colors.text },
  mockUpSub: { fontSize: 10, color: colors.textSecondary },
  badgeConfirmed: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: { fontSize: 9, fontWeight: '700', color: '#166534' },
  mockSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 6,
    marginBottom: 8,
  },
  mockSearchText: { fontSize: 11, color: colors.textSecondary },
  mockDoctorCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  mockDoctorAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mockDocName: { fontSize: 12, fontWeight: '700', color: colors.text },
  mockDocSub: { fontSize: 10, color: colors.textSecondary, marginTop: 1 },
  mockTagRow: { flexDirection: 'row', gap: 6, marginTop: 5 },
  mockTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.mint,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 3,
  },
  mockTagText: { fontSize: 9, fontWeight: '600', color: colors.primary },
  mockTabBar: { flexDirection: 'row', gap: 6, marginBottom: 8 },
  mockTabChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#E2E8F0',
  },
  mockTabChipActive: { backgroundColor: colors.primary },
  mockTabChipText: { fontSize: 10, fontWeight: '700', color: colors.textSecondary },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  mockDateText: { fontSize: 10, color: colors.primaryLight, fontWeight: '600', marginTop: 3 },
  mockActionRow: { flexDirection: 'row', gap: 10, marginTop: 6 },
  mockActionBtn: { fontSize: 10, fontWeight: '700', color: colors.primaryLight },
  mockAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 6,
    paddingVertical: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.mintDark,
  },
  mockAddBtnText: { fontSize: 11, fontWeight: '600', color: colors.primary },
  mockRowInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
  },
  mockRowText: { fontSize: 11, color: colors.text, fontWeight: '500' },
  mockStatNum: { fontSize: 14, fontWeight: '800', color: colors.primary },
});

