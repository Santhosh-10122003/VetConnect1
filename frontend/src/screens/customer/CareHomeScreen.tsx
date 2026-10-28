import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, RefreshControl, ScrollView } from 'react-native';
import { CompositeScreenProps, useFocusEffect } from '@react-navigation/native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { careApi, CATEGORIES, CareCategory, Provider } from '../../api/careApi';
import { customerApi } from '../../api/customerApi';
import { AppHeader } from '../../components/common/AppHeader';
import { EmptyState } from '../../components/common/EmptyState';
import { LoadingView } from '../../components/common/LoadingView';
import { ProviderCard } from '../../components/care/ProviderCard';
import { CustomerStackParamList, CustomerTabParamList } from '../../navigation/types';

type Props = CompositeScreenProps<
  BottomTabScreenProps<CustomerTabParamList, 'PetCare'>,
  NativeStackScreenProps<CustomerStackParamList>
>;

export const CareHomeScreen: React.FC<Props> = ({ navigation, route }) => {
  const [category, setCategory] = useState<CareCategory | undefined>(route.params?.category);
  const [query, setQuery] = useState('');
  const [radiusKm, setRadiusKm] = useState(25);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [city, setCity] = useState('');
  const [hasPin, setHasPin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // a link from elsewhere (e.g. the home screen tiles) can preselect a category
  useEffect(() => { if (route.params?.category) setCategory(route.params.category); }, [route.params?.category]);

  const load = useCallback(async () => {
    try {
      const [me, list] = await Promise.all([
        customerApi.getMyProfile(),
        careApi.providers({ category, query: query.trim() || undefined, radiusKm }),
      ]);
      setCity(me.data.city ?? '');
      setHasPin(me.data.latitude != null && me.data.longitude != null);
      setProviders(list.content);
    } catch (e) {
      console.warn('Error loading pet-care providers', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [category, query, radiusKm]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <View style={styles.container}>
      <AppHeader
        title="Pet Care"
        subtitle="Grooming, boarding and training near you"
        rightAction={{ icon: 'receipt-outline', onPress: () => navigation.navigate('CareBookings') }}
      />

      <View style={styles.top}>
        <View style={styles.search}>
          <Ionicons name="search" size={18} color={colors.textSecondary} style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by business name or area"
            placeholderTextColor={colors.textMuted}
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')}><Ionicons name="close-circle" size={18} color={colors.textMuted} /></TouchableOpacity>
          )}
        </View>

        <View style={styles.tiles}>
          {CATEGORIES.map((c) => {
            const active = category === c.key;
            return (
              <TouchableOpacity
                key={c.key}
                testID={`care-cat-${c.key}`}
                style={[styles.tile, active && styles.tileActive]}
                onPress={() => setCategory(active ? undefined : c.key)}
                activeOpacity={0.85}
              >
                <Ionicons name={c.icon as any} size={22} color={active ? '#FFFFFF' : colors.primary} />
                <Text style={[styles.tileTitle, active && { color: '#FFFFFF' }]}>{c.label}</Text>
                <Text style={[styles.tileSub, active && { color: '#DBEAFE' }]} numberOfLines={1}>{c.blurb}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.where}>
          <Ionicons name="location" size={16} color={colors.primary} />
          <Text style={styles.whereText} numberOfLines={1}>
            {city ? `Near ${city}` : 'No location set'}{hasPin ? ` · within ${radiusKm} km` : ''}
          </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Profile')}><Text style={styles.change}>Change</Text></TouchableOpacity>
        </View>
        {hasPin && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {[5, 10, 25, 50, 100].map((km) => (
              <TouchableOpacity key={km} style={[styles.radius, radiusKm === km && styles.radiusActive]} onPress={() => setRadiusKm(km)}>
                <Text style={[styles.radiusText, radiusKm === km && { color: '#FFFFFF' }]}>{km} km</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>

      {loading ? (
        <LoadingView message="Finding pet-care providers..." />
      ) : (
        <FlatList
          data={providers}
          keyExtractor={(p) => String(p.id)}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} colors={[colors.primary]} />}
          renderItem={({ item }) => <ProviderCard provider={item} onPress={() => navigation.navigate('CareProvider', { providerId: item.id })} />}
          ListEmptyComponent={
            <EmptyState
              icon="paw-outline"
              title="No providers found"
              message={city
                ? `No approved providers matched near ${city}. Try another service type${hasPin ? ', a wider distance' : ''}, or update your location.`
                : 'Add your place in your profile so we can show pet-care providers near you.'}
              actionTitle={city ? 'Show all services' : 'Set My Location'}
              onAction={() => (city ? (setCategory(undefined), setQuery('')) : navigation.navigate('Profile'))}
            />
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  top: { backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  search: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.background, borderRadius: 12, paddingHorizontal: 12, height: 46, marginTop: 10 },
  searchInput: { flex: 1, fontSize: 14, color: colors.text },
  tiles: { flexDirection: 'row', gap: 8, marginTop: 12 },
  tile: { flex: 1, backgroundColor: colors.mint, borderRadius: 14, padding: 10, borderWidth: 1, borderColor: colors.mintBorder },
  tileActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tileTitle: { fontSize: 13, fontWeight: '800', color: colors.text, marginTop: 6 },
  tileSub: { fontSize: 10, color: colors.textSecondary, marginTop: 1 },
  where: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, marginBottom: 4 },
  whereText: { flex: 1, fontSize: 13, fontWeight: '700', color: colors.text },
  change: { fontSize: 13, fontWeight: '700', color: colors.primary },
  radius: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16, backgroundColor: colors.background, marginRight: 8, marginTop: 6 },
  radiusActive: { backgroundColor: colors.primary },
  radiusText: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  list: { padding: 16, paddingBottom: 40 },
});
