import React, { useState, useEffect, useCallback } from 'react';
import { LocationPicker, LocationValue, emptyLocation } from '../../components/common/LocationPicker';
import { KeyboardAvoid } from '../../components/common/KeyboardScroll';
import { View, Text, FlatList, TextInput, TouchableOpacity, RefreshControl, ScrollView, Modal } from 'react-native';
import { CompositeScreenProps } from '@react-navigation/native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { money } from '../../utils/helpers';
import { doctorApi, DoctorProfile, Specialization } from '../../api/doctorApi';
import { customerApi } from '../../api/customerApi';
import { DoctorCard } from '../../components/doctor/DoctorCard';
import { EmptyState } from '../../components/common/EmptyState';
import { LoadingView } from '../../components/common/LoadingView';
import { CustomerTabParamList, CustomerStackParamList } from '../../navigation/types';
import { themedStyles } from '../../theme/themed';
import { stripEmoji } from '../../utils/inputRules';
import { useTopPad } from '../../utils/useTopPad';

type Props = CompositeScreenProps<
  BottomTabScreenProps<CustomerTabParamList, 'FindDoctors'>,
  NativeStackScreenProps<CustomerStackParamList>
>;

const DISTANCES = [5, 10, 25, 50, 100];

/** The Doctors tab: a few simple controls on top, then big, easy-to-read vet cards. */
export const FindDoctorsScreen: React.FC<Props> = ({ navigation, route }) => {
  const topPad = useTopPad(54);
  const [searchQuery, setSearchQuery] = useState(route.params?.query || '');
  const [selectedSpecId, setSelectedSpecId] = useState<number | undefined>(route.params?.specializationId);
  const [minRating, setMinRating] = useState<number | undefined>(undefined);
  const [maxFee, setMaxFee] = useState<number | undefined>(undefined);
  const [radiusKm, setRadiusKm] = useState<number>(25);
  const [myCity, setMyCity] = useState<string>('');
  const [myCountry, setMyCountry] = useState<string>('');
  const [hasGps, setHasGps] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  // a place picked here just to look around: it is never saved to the profile
  const [place, setPlace] = useState<LocationValue | null>(null);
  const [picking, setPicking] = useState(false);
  const [draft, setDraft] = useState<LocationValue>(emptyLocation);

  const [doctors, setDoctors] = useState<DoctorProfile[]>([]);
  const [specializations, setSpecializations] = useState<Specialization[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDoctors = useCallback(async () => {
    try {
      const res = await doctorApi.searchDoctors({
        query: searchQuery.trim() || undefined,
        specializationId: selectedSpecId,
        minRating,
        maxFee,
        radiusKm,
        ...(place ? { city: place.city, state: place.state || undefined, country: place.country || undefined, latitude: place.latitude, longitude: place.longitude } : {}),
        size: 30,
      });
      if (res.data?.content) setDoctors(res.data.content);
    } catch (e) {
      console.warn('Error fetching doctors', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [searchQuery, selectedSpecId, minRating, maxFee, radiusKm, place]);

  // Re-read the customer's location whenever the tab is shown (they may have just changed it in Profile).
  useEffect(() => {
    const load = () => customerApi.getMyProfile().then((r) => {
      setMyCity(r.data.city ?? '');
      setMyCountry(r.data.country ?? '');
      setHasGps(r.data.latitude != null && r.data.longitude != null);
    }).catch(() => {});
    load();
    return navigation.addListener('focus', () => { load(); fetchDoctors(); });
  }, [navigation, fetchDoctors]);

  useEffect(() => {
    doctorApi.getSpecializations().then((res) => { if (res.data) setSpecializations(res.data); });
  }, []);

  useEffect(() => { fetchDoctors(); }, [fetchDoctors]);

  const clearFilters = () => {
    setSelectedSpecId(undefined);
    setMinRating(undefined);
    setMaxFee(undefined);
    setSearchQuery('');
  };

  // how many filters are on, so the Filters button can say so
  const gps = place ? place.latitude != null && place.longitude != null : hasGps;
  const where = place ? place.city : myCity;
  const activeFilters = (minRating !== undefined ? 1 : 0) + (maxFee !== undefined ? 1 : 0) + (gps && radiusKm !== 25 ? 1 : 0);
  const anything = selectedSpecId !== undefined || activeFilters > 0 || searchQuery.length > 0;

  const summary = loading ? '' : doctors.length === 0 ? 'No vets match' : `${doctors.length} ${doctors.length === 1 ? 'vet' : 'vets'} ${where && gps ? `within ${radiusKm} km` : where ? `near ${where}` : 'found'}`;

  return (
    <KeyboardAvoid style={styles.container}>
      <View style={[styles.header, { paddingTop: topPad }]}>
        <Text style={styles.title}>Find a vet</Text>
        <View style={styles.placeRow}>
          <TouchableOpacity style={styles.place} onPress={() => { setDraft(place ?? emptyLocation); setPicking(true); }} activeOpacity={0.85} testID="doctors-place">
            <Ionicons name="location" size={14} color={colors.primary} />
            <Text style={styles.placeText} numberOfLines={1}>{where ? `${place ? 'Looking in' : 'Near'} ${where}` : 'Choose a place'}</Text>
            <Text style={styles.placeChange}>Change</Text>
          </TouchableOpacity>
          {place && (
            <TouchableOpacity onPress={() => setPlace(null)} style={styles.back} testID="doctors-place-reset">
              <Text style={styles.backText}>Back to my address</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.searchBox}>
          <Ionicons name="search" size={20} color={colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search a vet or clinic"
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={(t) => setSearchQuery(stripEmoji(t))}
            returnKeyType="search"
            testID="doctors-search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} accessibilityLabel="Clear search">
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {/* what kind of vet: one tap */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          <TouchableOpacity style={[styles.chip, selectedSpecId === undefined && styles.chipOn]} onPress={() => setSelectedSpecId(undefined)} activeOpacity={0.85}>
            <Text style={[styles.chipText, selectedSpecId === undefined && styles.chipTextOn]}>All vets</Text>
          </TouchableOpacity>
          {specializations.map((s) => (
            <TouchableOpacity key={s.id} style={[styles.chip, selectedSpecId === s.id && styles.chipOn]} onPress={() => setSelectedSpecId(selectedSpecId === s.id ? undefined : s.id)} activeOpacity={0.85}>
              <Text style={[styles.chipText, selectedSpecId === s.id && styles.chipTextOn]}>{s.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.summaryRow}>
          <Text style={styles.summary} testID="doctors-summary">{summary}</Text>
          <View style={{ flex: 1 }} />
          {anything && (
            <TouchableOpacity onPress={clearFilters} style={styles.reset} testID="doctors-reset"><Text style={styles.resetText}>Reset</Text></TouchableOpacity>
          )}
          <TouchableOpacity style={[styles.filterBtn, showFilters && styles.filterBtnOn]} onPress={() => setShowFilters((v) => !v)} activeOpacity={0.85} testID="doctors-filters">
            <Ionicons name="options-outline" size={16} color={showFilters ? '#FFFFFF' : colors.primary} />
            <Text style={[styles.filterBtnText, showFilters && { color: '#FFFFFF' }]}>Filters{activeFilters > 0 ? ` (${activeFilters})` : ''}</Text>
          </TouchableOpacity>
        </View>

        {showFilters && (
          <View style={styles.panel} testID="doctors-filter-panel">
            {gps && (
              <>
                <Text style={styles.panelLabel}>How far</Text>
                <View style={styles.panelRow}>
                  {DISTANCES.map((km) => (
                    <TouchableOpacity key={km} style={[styles.chip, radiusKm === km && styles.chipOn]} onPress={() => setRadiusKm(km)} activeOpacity={0.85}>
                      <Text style={[styles.chipText, radiusKm === km && styles.chipTextOn]}>{km} km</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}
            <Text style={styles.panelLabel}>Good to have</Text>
            <View style={styles.panelRow}>
              <TouchableOpacity style={[styles.chip, minRating === 4.5 && styles.chipOn]} onPress={() => setMinRating(minRating === 4.5 ? undefined : 4.5)} activeOpacity={0.85}>
                <Ionicons name="star" size={13} color={minRating === 4.5 ? '#FFFFFF' : colors.star} />
                <Text style={[styles.chipText, minRating === 4.5 && styles.chipTextOn]}>Top rated (4.5 and up)</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.chip, maxFee === 75 && styles.chipOn]} onPress={() => setMaxFee(maxFee === 75 ? undefined : 75)} activeOpacity={0.85}>
                <Text style={[styles.chipText, maxFee === 75 && styles.chipTextOn]}>Fee under {money(75, 0)}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {loading ? (
        <LoadingView message="Finding vets near you..." />
      ) : (
        <FlatList
          data={doctors}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <DoctorCard
              doctor={item}
              onPress={() => navigation.navigate('DoctorProfile', { doctorId: item.id })}
              onBookPress={() => navigation.navigate('BookAppointment', { doctorId: item.id })}
            />
          )}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchDoctors(); }} colors={[colors.primary]} />}
          ListEmptyComponent={
            <EmptyState
              icon="search-outline"
              title="No vets found"
              message={where
                ? `We could not find a vet near ${where} with those choices. Try fewer filters${gps ? ' or a longer distance' : ''}, or look in another place.`
                : 'Choose a place so we can show vets near it.'}
              actionTitle={where ? 'Show all vets' : 'Choose a place'}
              onAction={() => (where ? clearFilters() : (setDraft(emptyLocation), setPicking(true)))}
            />
          }
        />
      )}

      {/* look somewhere else: only for this search, nothing in the profile changes */}
      <Modal visible={picking} animationType="slide" onRequestClose={() => setPicking(false)}>
        <View style={styles.sheet}>
          <View style={styles.sheetHead}>
            <Text style={styles.sheetTitle}>Where should we look?</Text>
            <TouchableOpacity onPress={() => setPicking(false)} accessibilityLabel="Close" testID="doctors-place-close">
              <Ionicons name="close" size={26} color={colors.text} />
            </TouchableOpacity>
          </View>
          <Text style={styles.sheetNote}>This is only for finding vets. Your saved address is not changed.</Text>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
            <LocationPicker value={draft} onChange={setDraft} districtLabel="District / City" mapFirst defaultCountry={myCountry || 'India'} />
            <TouchableOpacity
              style={[styles.go, !draft.city.trim() && { opacity: 0.4 }]}
              disabled={!draft.city.trim()}
              onPress={() => { setPlace(draft); setPicking(false); }}
              activeOpacity={0.85}
              testID="doctors-place-apply"
            >
              <Text style={styles.goText}>Show vets here</Text>
            </TouchableOpacity>
            {!!myCity && (
              <TouchableOpacity style={styles.useMine} onPress={() => { setPlace(null); setPicking(false); }} testID="doctors-place-mine">
                <Text style={styles.useMineText}>Use my saved address ({myCity})</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>
      </Modal>
    </KeyboardAvoid>
  );
};

const styles = themedStyles(() => ({
  placeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8, marginBottom: 14, flexWrap: 'wrap' },
  back: { paddingVertical: 6 },
  backText: { fontSize: 13, fontWeight: '800', color: colors.primaryLight },
  sheet: { flex: 1, backgroundColor: colors.page },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 54, paddingBottom: 6 },
  sheetTitle: { fontSize: 22, fontWeight: '800', color: colors.text },
  sheetNote: { fontSize: 13, color: colors.textSecondary, paddingHorizontal: 16, paddingBottom: 6 },
  go: { backgroundColor: colors.primary, borderRadius: 18, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  goText: { color: '#FFFFFF', fontWeight: '800', fontSize: 16 },
  useMine: { alignItems: 'center', paddingVertical: 16 },
  useMineText: { fontSize: 14, fontWeight: '800', color: colors.primaryLight },
  container: { flex: 1, backgroundColor: colors.page },
  header: { backgroundColor: colors.card, paddingHorizontal: 16, paddingTop: 54, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { fontSize: 30, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  place: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', backgroundColor: colors.mint, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 14 },
  placeText: { fontSize: 13, fontWeight: '800', color: colors.ink, maxWidth: 200 },
  placeChange: { fontSize: 13, fontWeight: '700', color: colors.primaryLight, marginLeft: 4 },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.background, borderRadius: 18, paddingHorizontal: 14, height: 52, borderWidth: 1, borderColor: colors.border },
  searchInput: { flex: 1, fontSize: 16, color: colors.text },
  chips: { gap: 8, paddingTop: 12, paddingBottom: 2 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 18, backgroundColor: colors.subtle },
  chipOn: { backgroundColor: colors.primary },
  chipText: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
  chipTextOn: { color: '#FFFFFF' },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  summary: { fontSize: 14, fontWeight: '700', color: colors.text },
  reset: { paddingHorizontal: 6, paddingVertical: 4 },
  resetText: { fontSize: 13, fontWeight: '800', color: colors.danger },
  filterBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.mint, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14 },
  filterBtnOn: { backgroundColor: colors.primary },
  filterBtnText: { fontSize: 13, fontWeight: '800', color: colors.ink },
  panel: { marginTop: 12, backgroundColor: colors.background, borderRadius: 18, padding: 14, borderWidth: 1, borderColor: colors.border },
  panelLabel: { fontSize: 12, fontWeight: '800', color: colors.textSecondary, marginBottom: 8, marginTop: 4 },
  panelRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  list: { padding: 16, paddingBottom: 100 },
}));
