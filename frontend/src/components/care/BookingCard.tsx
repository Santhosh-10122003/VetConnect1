import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { shared } from '../../theme/shared';
import { StatusBadge } from '../common/StatusBadge';
import { CareBooking, categoryLabel } from '../../api/careApi';
import { hhmm } from '../../utils/helpers';

export const careWhen = (b: CareBooking) =>
  b.checkOutDate ? `${b.date} to ${b.checkOutDate}${b.nights ? ` (${b.nights} night${b.nights === 1 ? '' : 's'})` : ''}` : `${b.date}${b.startTime ? ` · ${hhmm(b.startTime)}${b.endTime ? ' - ' + hhmm(b.endTime) : ''}` : ''}`;

export const careWhat = (b: CareBooking) => b.items.filter((i) => i.main).map((i) => i.name)[0] ?? categoryLabel(b.category);

interface Props {
  booking: CareBooking;
  /** "customer" shows the business, "provider" shows the pet owner. */
  viewer: 'customer' | 'provider';
  onPress?: () => void;
  children?: React.ReactNode;
}

export const BookingCard: React.FC<Props> = ({ booking: b, viewer, onPress, children }) => (
  <TouchableOpacity style={shared.card} onPress={onPress} activeOpacity={onPress ? 0.85 : 1} disabled={!onPress} testID={`care-booking-${b.reference}`}>
    <View style={shared.rowBetween}>
      <Text style={styles.ref}>{b.reference}</Text>
      <StatusBadge status={b.status} />
    </View>
    <Text style={styles.title}>{careWhat(b)}</Text>
    <Text style={styles.sub}>{viewer === 'customer' ? b.providerName : `${b.customerName}${b.customerPhone ? ' · ' + b.customerPhone : ''}`}</Text>
    <View style={styles.line}>
      <Ionicons name="paw-outline" size={14} color={colors.textSecondary} />
      <Text style={styles.lineText}>{b.petName}{b.petBreed ? ` (${b.petBreed})` : ''} · {b.petSize.charAt(0) + b.petSize.slice(1).toLowerCase()}</Text>
    </View>
    {!!b.petAllergies && viewer === 'provider' && (
      <View style={styles.line}>
        <Ionicons name="warning-outline" size={14} color={colors.warning} />
        <Text style={styles.lineText}>Allergies: {b.petAllergies}</Text>
      </View>
    )}
    <View style={styles.line}>
      <Ionicons name="calendar-outline" size={14} color={colors.textSecondary} />
      <Text style={styles.lineText}>{careWhen(b)}</Text>
    </View>
    {children}
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  ref: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  title: { fontSize: 16, fontWeight: '800', color: colors.text, marginTop: 8 },
  sub: { fontSize: 13, color: colors.textSecondary, marginTop: 2, marginBottom: 6 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  lineText: { fontSize: 13, color: colors.text, flex: 1 },
});
