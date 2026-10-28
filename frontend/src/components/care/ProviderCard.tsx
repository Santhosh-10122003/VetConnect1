import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { Provider, categoryLabel } from '../../api/careApi';
import { money } from '../../utils/helpers';
import { IconText } from '../common/IconText';

interface Props {
  provider: Provider;
  onPress: () => void;
}

export const ProviderCard: React.FC<Props> = ({ provider: p, onPress }) => (
  <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.9} testID={`provider-${p.businessName}`}>
    <View style={styles.top}>
      <View style={styles.avatar}>
        <Ionicons name={p.categories.includes('BOARDING') ? 'bed' : p.categories.includes('TRAINING') ? 'school' : 'cut'} size={26} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.name} numberOfLines={1}>{p.businessName}</Text>
        <IconText icon="location-outline" iconColor={colors.textSecondary} textStyle={styles.place} numberOfLines={1} style={styles.placeRow}>
          {p.city && !p.address.toLowerCase().includes(p.city.toLowerCase()) ? `${p.address}, ${p.city}` : p.address}
        </IconText>
        <View style={styles.meta}>
          <View style={styles.rating}>
            <Ionicons name="star" size={13} color={colors.star} />
            <Text style={styles.ratingText}>{p.reviewCount > 0 ? p.ratingAvg.toFixed(1) : 'New'}</Text>
            {p.reviewCount > 0 && <Text style={styles.count}>({p.reviewCount})</Text>}
          </View>
          {p.distanceKm != null && (
            <IconText icon="navigate-outline" size={12} iconColor={colors.primary} textStyle={styles.distance}>
              {p.distanceKm < 1 ? '< 1' : p.distanceKm.toFixed(1)} km away
            </IconText>
          )}
        </View>
      </View>
    </View>
    <View style={styles.chips}>
      {p.categories.map((c) => (
        <View key={c} style={styles.chip}><Text style={styles.chipText}>{categoryLabel(c)}</Text></View>
      ))}
    </View>
    <View style={styles.footer}>
      <View>
        <Text style={styles.footLabel}>{p.fromPrice != null ? 'Starting from' : 'Menu'}</Text>
        <Text style={styles.price}>{p.fromPrice != null ? money(p.fromPrice, 0) : 'See services'}</Text>
      </View>
      <Text style={styles.advance}>Book with {p.advancePercent}% advance</Text>
    </View>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: 18, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: colors.border, elevation: 2 },
  top: { flexDirection: 'row', gap: 12 },
  avatar: { width: 54, height: 54, borderRadius: 16, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 16, fontWeight: '800', color: colors.text },
  placeRow: { marginTop: 2 },
  place: { fontSize: 12, color: colors.textSecondary },
  meta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 12, rowGap: 4, marginTop: 6 },
  rating: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#FFFBEB', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  ratingText: { fontSize: 12, fontWeight: '800', color: colors.text },
  count: { fontSize: 11, color: colors.textSecondary },
  distance: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  chip: { backgroundColor: colors.mint, borderWidth: 1, borderColor: colors.mintBorder, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  chipText: { fontSize: 11, fontWeight: '700', color: colors.primary },
  footer: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 12, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10 },
  footLabel: { fontSize: 10, color: colors.textSecondary, textTransform: 'uppercase' },
  price: { fontSize: 18, fontWeight: '800', color: colors.primary },
  advance: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
});
