import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { OsmMap } from './OsmMap';
import { openDirections } from '../../utils/maps';

interface Props {
  clinicName?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  latitude?: number | null;
  longitude?: number | null;
  mapHeight?: number;
  /** Hide the map and show only the address and the button. */
  compact?: boolean;
}

/** Where the clinic is: address, a small map with its pin, and a button that opens turn-by-turn navigation. */
export const ClinicLocationCard: React.FC<Props> = ({
  clinicName, address, city, state, country, latitude, longitude, mapHeight = 170, compact,
}) => {
  const pinned = latitude != null && longitude != null;
  // add the city, state and country only where the street address does not already say them
  const street = (address || '').trim();
  const extra = [city, state, country].filter((p): p is string => !!p && !street.toLowerCase().includes(p.toLowerCase()));
  const fullAddress = [street, ...extra].filter(Boolean).join(', ');

  return (
    <View>
      <View style={styles.row}>
        <Ionicons name="location" size={20} color={colors.primary} style={{ marginTop: 2 }} />
        <View style={{ flex: 1, marginLeft: 8 }}>
          {clinicName ? <Text style={styles.name}>{clinicName}</Text> : null}
          <Text style={styles.address}>{fullAddress || 'Address not provided'}</Text>
        </View>
      </View>

      {pinned && !compact ? (
        <View style={{ marginTop: 12 }}>
          <OsmMap latitude={latitude} longitude={longitude} height={mapHeight} zoom={15} />
        </View>
      ) : null}

      <TouchableOpacity
        style={styles.button}
        onPress={() => openDirections({ latitude, longitude, name: clinicName, address: fullAddress })}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="Get directions to the clinic"
        testID="get-directions"
      >
        <Ionicons name="navigate" size={18} color="#FFFFFF" />
        <Text style={styles.buttonText}>Get Directions</Text>
      </TouchableOpacity>
      {!pinned ? <Text style={styles.note}>The clinic has not pinned its exact spot yet; directions use the address.</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  name: { fontSize: 15, fontWeight: '700', color: colors.text },
  address: { fontSize: 13, color: colors.textSecondary, marginTop: 2, lineHeight: 18 },
  button: {
    marginTop: 12,
    height: 46,
    borderRadius: 12,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buttonText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
  note: { fontSize: 11, color: colors.textSecondary, marginTop: 6 },
});
