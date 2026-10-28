import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { StatusBadge } from '../common/StatusBadge';
import { Appointment } from '../../api/appointmentApi';
import { drName } from '../../utils/helpers';

interface AppointmentCardProps {
  appointment: Appointment;
  onPress: () => void;
  onCancelPress?: () => void;
  onReviewPress?: () => void;
  isDoctorView?: boolean;
}

export const AppointmentCard: React.FC<AppointmentCardProps> = ({
  appointment,
  onPress,
  onCancelPress,
  onReviewPress,
  isDoctorView = false,
}) => {
  const isUpcoming = appointment.status === 'CONFIRMED' || appointment.status === 'PENDING' || appointment.status === 'AWAITING_PAYMENT';
  const isCompleted = appointment.status === 'COMPLETED';

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.88}>
      <View style={styles.header}>
        <View style={styles.refContainer}>
          <Ionicons name="bookmark-outline" size={14} color={colors.primary} />
          <Text style={styles.refCode}>{appointment.bookingReference}</Text>
        </View>
        <StatusBadge status={appointment.status} />
      </View>

      {appointment.rescheduleRequest && (
        <View style={styles.reschedTag} testID="reschedule-tag">
          <Ionicons name="swap-horizontal" size={14} color={colors.warning} />
          <Text style={styles.reschedTagText} numberOfLines={1}>
            {isDoctorView ? 'Reschedule requested' : 'Reschedule pending'}: {appointment.rescheduleRequest.appointmentDate} {appointment.rescheduleRequest.startTime.substring(0, 5)}
          </Text>
        </View>
      )}

      <View style={styles.datetimeBanner}>
        <View style={styles.dateBlock}>
          <Ionicons name="calendar" size={16} color={colors.primary} />
          <Text style={styles.dateText}>{appointment.appointmentDate}</Text>
        </View>
        <View style={styles.timeBlock}>
          <Ionicons name="time" size={16} color={colors.primary} />
          <Text style={styles.timeText}>
            {appointment.startTime.substring(0, 5)} - {appointment.endTime.substring(0, 5)}
          </Text>
        </View>
      </View>

      <View style={styles.body}>
        <View style={styles.entityRow}>
          <View style={styles.iconCircle}>
            <Ionicons name="paw" size={16} color={colors.primary} />
          </View>
          <View style={styles.entityInfo}>
            <Text style={styles.entityTitle}>{appointment.petName}</Text>
            <Text style={styles.entitySubtitle}>
              {appointment.petSpecies} {appointment.petBreed ? `(${appointment.petBreed})` : ''}
            </Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.entityRow}>
          <View style={styles.iconCircle}>
            <Ionicons name={isDoctorView ? 'person-outline' : 'medkit-outline'} size={16} color={colors.primary} />
          </View>
          <View style={styles.entityInfo}>
            <Text style={styles.entityTitle}>
              {isDoctorView ? appointment.customerName : drName(appointment.doctorName)}
            </Text>
            <Text style={styles.entitySubtitle} numberOfLines={1}>
              {appointment.clinicName} • {appointment.clinicAddress}
            </Text>
          </View>
        </View>

        {appointment.reason ? (
          <View style={styles.reasonBox}>
            <Text style={styles.reasonLabel}>Reason for visit:</Text>
            <Text style={styles.reasonText} numberOfLines={2}>{appointment.reason}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.detailsBtn} onPress={onPress}>
          <Text style={styles.detailsBtnText}>View Details</Text>
          <Ionicons name="arrow-forward" size={14} color={colors.primary} />
        </TouchableOpacity>

        {isUpcoming && onCancelPress && (
          <TouchableOpacity style={styles.cancelBtn} onPress={onCancelPress}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
        )}

        {!isDoctorView && isCompleted && !appointment.hasReview && onReviewPress && (
          <TouchableOpacity style={styles.reviewBtn} onPress={onReviewPress}>
            <Ionicons name="star" size={14} color="#FFFFFF" />
            <Text style={styles.reviewBtnText}>Leave Review</Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  reschedTag: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FFFBEB', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginBottom: 10, borderWidth: 1, borderColor: '#FDE68A' },
  reschedTagText: { flex: 1, fontSize: 12, fontWeight: '700', color: '#92400E' },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  refContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  refCode: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: 0.5,
  },
  datetimeBanner: {
    flexDirection: 'row',
    backgroundColor: colors.mint,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    justifyContent: 'space-between',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.mintBorder,
  },
  dateBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dateText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  timeBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  timeText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  body: {
    gap: 10,
  },
  entityRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  entityInfo: {
    flex: 1,
  },
  entityTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  entitySubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 1,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 2,
  },
  reasonBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 8,
    marginTop: 4,
  },
  reasonLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 2,
  },
  reasonText: {
    fontSize: 13,
    color: colors.text,
    lineHeight: 18,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  detailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailsBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  cancelBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  cancelBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.danger,
  },
  reviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.star,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  reviewBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
