import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';

interface StatusBadgeProps {
  status: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const getBadgeStyle = () => {
    switch (status.toUpperCase()) {
      case 'CONFIRMED':
      case 'APPROVED':
        return {
          bg: '#ECFDF5',
          text: colors.statusConfirmed,
          border: '#A7F3D0',
        };
      case 'PENDING':
      case 'REQUESTED':
      case 'AWAITING_PAYMENT':
      case 'RESUBMITTED':
        return {
          bg: '#FFFBEB',
          text: colors.statusPending,
          border: '#FDE68A',
        };
      case 'COMPLETED':
        return {
          bg: colors.mint,
          text: colors.primary,
          border: colors.mintDark,
        };
      case 'CANCELLED':
      case 'REJECTED':
      case 'EXPIRED':
      case 'NO_SHOW':
        return {
          bg: '#FEF2F2',
          text: colors.statusCancelled,
          border: '#FECACA',
        };
      default:
        return {
          bg: '#F1F5F9',
          text: colors.textSecondary,
          border: colors.border,
        };
    }
  };

  const style = getBadgeStyle();

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: style.bg, borderColor: style.border },
      ]}
    >
      <Text style={[styles.text, { color: style.text }]}>{status.replace(/_/g, ' ')}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
