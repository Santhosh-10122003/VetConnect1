import React from 'react';
import { View, Text } from 'react-native';
import { colors } from '../../theme/colors';
import { themedStyles } from '../../theme/themed';

interface StatusBadgeProps {
  status: string;
}

/** The status in everyday words rather than a code like AWAITING_PAYMENT. */
export const statusWords = (status: string): string => {
  const known: Record<string, string> = {
    AWAITING_PAYMENT: 'Waiting for payment',
    PENDING: 'Waiting for reply',
    REQUESTED: 'Waiting for reply',
    CONFIRMED: 'Confirmed',
    COMPLETED: 'Done',
    CANCELLED: 'Cancelled',
    REJECTED: 'Declined',
    EXPIRED: 'Expired',
    NO_SHOW: 'Missed',
    APPROVED: 'Approved',
    RESUBMITTED: 'Sent again',
  };
  const key = status.toUpperCase();
  if (known[key]) return known[key];
  const plain = status.replace(/_/g, ' ').toLowerCase();
  return plain.charAt(0).toUpperCase() + plain.slice(1);
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const getBadgeStyle = () => {
    switch (status.toUpperCase()) {
      case 'CONFIRMED':
      case 'APPROVED':
        return {
          bg: colors.successBg,
          text: colors.statusConfirmed,
          border: colors.successBorder,
        };
      case 'PENDING':
      case 'REQUESTED':
      case 'AWAITING_PAYMENT':
      case 'RESUBMITTED':
        return {
          bg: colors.warnBg,
          text: colors.statusPending,
          border: colors.warnBorder,
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
          bg: colors.dangerBg,
          text: colors.statusCancelled,
          border: colors.dangerBorder,
        };
      default:
        return {
          bg: colors.subtle,
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
      <Text style={[styles.text, { color: style.text }]}>{statusWords(status)}</Text>
    </View>
  );
};

const styles = themedStyles(() => ({
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
}));
