import React from 'react';
import { Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { useTour } from './TourProvider';
import { themedStyles } from '../theme/themed';

/** "Take the app tour": replays the guided tour from the start. */
export const TakeTourButton: React.FC = () => {
  const tour = useTour();
  return (
    <TouchableOpacity style={styles.btn} onPress={tour.start} activeOpacity={0.85} testID="take-tour">
      <Ionicons name="compass-outline" size={18} color={colors.primary} />
      <Text style={styles.text}>Take the app tour</Text>
    </TouchableOpacity>
  );
};

const styles = themedStyles(() => ({
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 13, borderRadius: 16, backgroundColor: colors.mint, marginBottom: 12 },
  text: { fontSize: 14, fontWeight: '800', color: colors.ink },
}));
