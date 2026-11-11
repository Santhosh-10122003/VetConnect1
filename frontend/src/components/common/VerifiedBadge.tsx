import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { themedStyles } from '../../theme/themed';

/** A small mark shown once the admin has approved an account: enough to say "this one is verified". */
export const VerifiedBadge: React.FC = () => (
  <View style={styles.badge} testID="verified-badge" accessibilityLabel="Verified by Jenni">
    <Ionicons name="shield-checkmark" size={14} color={colors.successText} />
    <Text style={styles.text}>Verified</Text>
  </View>
);

const styles = themedStyles(() => ({
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 12, backgroundColor: colors.successBg, borderWidth: 1, borderColor: colors.successBorder },
  text: { fontSize: 11, fontWeight: '800', color: colors.successText },
}));
