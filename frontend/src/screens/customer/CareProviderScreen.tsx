import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { shared } from '../../theme/shared';
import { careApi, CareReview, CareService, CATEGORIES, Provider, categoryLabel } from '../../api/careApi';
import { AppHeader } from '../../components/common/AppHeader';
import { AppButton } from '../../components/common/AppButton';
import { LoadingView } from '../../components/common/LoadingView';
import { ClinicLocationCard } from '../../components/common/ClinicLocationCard';
import { CustomerStackParamList } from '../../navigation/types';
import { getErrorMessage, money, notify } from '../../utils/helpers';

type Props = NativeStackScreenProps<CustomerStackParamList, 'CareProvider'>;

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const priceChips = (s: CareService) => [
  ['S', s.priceSmall], ['M', s.priceMedium], ['L', s.priceLarge], ['XL', s.priceGiant],
] as const;

export const CareProviderScreen: React.FC<Props> = ({ navigation, route }) => {
  const [provider, setProvider] = useState<Provider | null>(null);
  const [reviews, setReviews] = useState<CareReview[]>([]);

  useEffect(() => {
    careApi.provider(route.params.providerId).then(setProvider).catch((e) => {
      notify('Not available', getErrorMessage(e));
      navigation.goBack();
    });
    careApi.reviews(route.params.providerId).then((r) => setReviews(r.content)).catch(() => {});
  }, [route.params.providerId, navigation]);

  if (!provider) return <LoadingView />;

  const services = provider.services ?? [];
  const hours = provider.hours ?? [];

  return (
    <View style={shared.screen}>
      <AppHeader title={provider.businessName} subtitle={provider.categories.map(categoryLabel).join(' · ')} showBack onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={shared.content}>
        <View style={shared.card}>
          <View style={shared.rowBetween}>
            <View style={styles.rating}>
              <Ionicons name="star" size={15} color={colors.star} />
              <Text style={styles.ratingText}>{provider.reviewCount > 0 ? `${provider.ratingAvg.toFixed(1)} (${provider.reviewCount} reviews)` : 'New'}</Text>
            </View>
            {provider.distanceKm != null && <Text style={styles.distance}>{provider.distanceKm < 1 ? '< 1' : provider.distanceKm.toFixed(1)} km away</Text>}
          </View>
          {!!provider.description && <Text style={styles.about}>{provider.description}</Text>}
          <View style={styles.advance}>
            <Ionicons name="card-outline" size={18} color={colors.primary} />
            <Text style={styles.advanceText}>Pay <Text style={{ fontWeight: '800' }}>{provider.advancePercent}%</Text> in advance to book. The rest is paid at the visit.</Text>
          </View>
        </View>

        <View style={shared.card}>
          <Text style={shared.sectionTitle}>Location</Text>
          <ClinicLocationCard
            clinicName={provider.businessName}
            address={provider.address}
            city={provider.city}
            state={provider.state}
            country={provider.country}
            latitude={provider.latitude}
            longitude={provider.longitude}
          />
        </View>

        {CATEGORIES.filter((c) => services.some((s) => s.category === c.key)).map((c) => {
          const mains = services.filter((s) => s.category === c.key && !s.isAddon);
          const extras = services.filter((s) => s.category === c.key && s.isAddon);
          return (
            <View key={c.key} style={shared.card}>
              <Text style={shared.sectionTitle}>{c.label}</Text>
              {mains.map((s) => (
                <View key={s.id} style={styles.service}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sName}>{s.name}</Text>
                    {!!s.description && <Text style={styles.sDesc}>{s.description}</Text>}
                    <Text style={styles.sMeta}>{s.durationMinutes ? `${s.durationMinutes} min` : s.pricingUnit === 'PER_NIGHT' ? 'per night' : ''}</Text>
                    <View style={styles.prices}>
                      {priceChips(s).map(([k, v]) => (
                        <View key={k} style={styles.price}><Text style={styles.priceK}>{k}</Text><Text style={styles.priceV}>{money(v, 0)}</Text></View>
                      ))}
                    </View>
                  </View>
                  <AppButton
                    title="Book"
                    style={styles.bookBtn}
                    onPress={() => navigation.navigate('CareBook', { providerId: provider.id, serviceId: s.id })}
                  />
                </View>
              ))}
              {extras.length > 0 && (
                <View style={styles.extras}>
                  <Text style={styles.extrasTitle}>Extras you can add</Text>
                  {extras.map((s) => (
                    <Text key={s.id} style={styles.extra}>{s.name} · from {money(s.priceSmall, 0)}</Text>
                  ))}
                </View>
              )}
            </View>
          );
        })}
        <Text style={styles.sizeNote}>Prices by pet size: S up to 7 kg · M 7 to 20 · L 20 to 35 · XL over 35 kg.</Text>

        {hours.length > 0 && (
          <View style={shared.card}>
            <Text style={shared.sectionTitle}>Opening hours</Text>
            {hours.map((h) => (
              <View key={h.dayOfWeek} style={[shared.rowBetween, { paddingVertical: 4 }]}>
                <Text style={styles.day}>{DAYS[h.dayOfWeek - 1]}</Text>
                <Text style={[styles.time, !h.isOpen && { color: colors.textMuted }]}>{h.isOpen ? `${h.openTime.substring(0, 5)} - ${h.closeTime.substring(0, 5)}` : 'Closed'}</Text>
              </View>
            ))}
          </View>
        )}

        {reviews.length > 0 && (
          <View style={shared.card}>
            <Text style={shared.sectionTitle}>Reviews</Text>
            {reviews.map((r) => (
              <View key={r.id} style={styles.review}>
                <View style={shared.rowBetween}>
                  <Text style={styles.reviewer}>{r.customerName}</Text>
                  <Text style={styles.stars}>{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</Text>
                </View>
                {!!r.comment && <Text style={styles.comment}>{r.comment}</Text>}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  rating: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ratingText: { fontSize: 14, fontWeight: '700', color: colors.text },
  distance: { fontSize: 13, fontWeight: '700', color: colors.primary },
  about: { fontSize: 13, color: colors.textSecondary, lineHeight: 19, marginTop: 10 },
  advance: { flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: colors.mint, padding: 10, borderRadius: 10, marginTop: 12 },
  advanceText: { flex: 1, fontSize: 12, color: colors.text, lineHeight: 17 },
  service: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  sName: { fontSize: 15, fontWeight: '700', color: colors.text },
  sDesc: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  sMeta: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  prices: { flexDirection: 'row', gap: 6, marginTop: 8, flexWrap: 'wrap' },
  price: { flexDirection: 'row', gap: 4, backgroundColor: colors.background, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  priceK: { fontSize: 11, fontWeight: '800', color: colors.textSecondary },
  priceV: { fontSize: 11, fontWeight: '700', color: colors.text },
  bookBtn: { height: 40, paddingHorizontal: 16, minWidth: 70 },
  extras: { marginTop: 10 },
  extrasTitle: { fontSize: 12, fontWeight: '800', color: colors.textSecondary, marginBottom: 4 },
  extra: { fontSize: 12, color: colors.text, paddingVertical: 2 },
  sizeNote: { fontSize: 11, color: colors.textSecondary, textAlign: 'center', marginBottom: 14 },
  day: { fontSize: 13, color: colors.text, fontWeight: '600' },
  time: { fontSize: 13, color: colors.text },
  review: { paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  reviewer: { fontSize: 13, fontWeight: '700', color: colors.text },
  stars: { color: colors.star, fontSize: 13 },
  comment: { fontSize: 12, color: colors.textSecondary, marginTop: 4 },
});
