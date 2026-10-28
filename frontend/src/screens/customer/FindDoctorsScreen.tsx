import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  RefreshControl,
  ScrollView,
} from 'react-native';
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

type Props = CompositeScreenProps<
  BottomTabScreenProps<CustomerTabParamList, 'FindDoctors'>,
  NativeStackScreenProps<CustomerStackParamList>
>;

export const FindDoctorsScreen: React.FC<Props> = ({ navigation, route }) => {
  const [searchQuery, setSearchQuery] = useState(route.params?.query || '');
  const [selectedSpecId, setSelectedSpecId] = useState<number | undefined>(route.params?.specializationId);
  const [minRating, setMinRating] = useState<number | undefined>(undefined);
  const [maxFee, setMaxFee] = useState<number | undefined>(undefined);
  const [radiusKm, setRadiusKm] = useState<number>(25);
  const [myCity, setMyCity] = useState<string>('');
  const [hasGps, setHasGps] = useState(false);

  const [doctors, setDoctors] = useState<DoctorProfile[]>([]);
  const [specializations, setSpecializations] = useState<Specialization[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDoctors = useCallback(async () => {
    try {
      const res = await doctorApi.searchDoctors({
        query: searchQuery.trim() || undefined,
        specializationId: selectedSpecId,
        minRating: minRating,
        maxFee: maxFee,
        radiusKm,
        size: 30,
      });
      if (res.data?.content) {
        setDoctors(res.data.content);
      }
    } catch (e) {
      console.warn('Error fetching doctors', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [searchQuery, selectedSpecId, minRating, maxFee, radiusKm]);

  // Re-read the customer's location whenever the tab is shown (they may have just changed it in Profile).
  useEffect(() => {
    const load = () => customerApi.getMyProfile().then((r) => {
      setMyCity(r.data.city ?? '');
      setHasGps(r.data.latitude != null && r.data.longitude != null);
    }).catch(() => {});
    load();
    return navigation.addListener('focus', () => { load(); fetchDoctors(); });
  }, [navigation, fetchDoctors]);

  useEffect(() => {
    doctorApi.getSpecializations().then((res) => {
      if (res.data) setSpecializations(res.data);
    });
  }, []);

  useEffect(() => {
    fetchDoctors();
  }, [fetchDoctors]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchDoctors();
  };

  return (
    <View style={styles.container}>
      {/* Search Header */}
      <View style={styles.searchHeader}>
        <View style={styles.searchInputContainer}>
          <Ionicons name="search" size={20} color={colors.textSecondary} style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name, clinic, or location..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Specialization Filter Chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          <TouchableOpacity
            style={[styles.filterChip, selectedSpecId === undefined && styles.activeFilterChip]}
            onPress={() => setSelectedSpecId(undefined)}
          >
            <Text style={[styles.filterChipText, selectedSpecId === undefined && styles.activeFilterChipText]}>
              All Specializations
            </Text>
          </TouchableOpacity>
          {specializations.map((s) => (
            <TouchableOpacity
              key={s.id}
              style={[styles.filterChip, selectedSpecId === s.id && styles.activeFilterChip]}
              onPress={() => setSelectedSpecId(selectedSpecId === s.id ? undefined : s.id)}
            >
              <Text style={[styles.filterChipText, selectedSpecId === s.id && styles.activeFilterChipText]}>
                {s.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Where we are searching */}
        <View style={styles.locationRow}>
          <Ionicons name="location" size={16} color={colors.primary} />
          <Text style={styles.locationText} numberOfLines={1}>
            {myCity ? `Near ${myCity}` : 'No location set'}
            {hasGps ? ` · within ${radiusKm} km` : ''}
          </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Profile')}>
            <Text style={styles.locationChange}>Change</Text>
          </TouchableOpacity>
        </View>
        {hasGps && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
            {[5, 10, 25, 50, 100].map((km) => (
              <TouchableOpacity
                key={km}
                style={[styles.filterChip, radiusKm === km && styles.activeFilterChip]}
                onPress={() => setRadiusKm(km)}
              >
                <Text style={[styles.filterChipText, radiusKm === km && styles.activeFilterChipText]}>{km} km</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Rating and Fee secondary filters */}
        <View style={styles.quickFiltersRow}>
          <TouchableOpacity
            style={[styles.smallFilter, minRating === 4.5 && styles.activeSmallFilter]}
            onPress={() => setMinRating(minRating === 4.5 ? undefined : 4.5)}
          >
            <Ionicons name="star" size={12} color={minRating === 4.5 ? '#FFFFFF' : colors.star} />
            <Text style={[styles.smallFilterText, minRating === 4.5 && styles.activeSmallFilterText]}>
              4.5+ Stars
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.smallFilter, maxFee === 75 && styles.activeSmallFilter]}
            onPress={() => setMaxFee(maxFee === 75 ? undefined : 75)}
          >
            <Text style={[styles.smallFilterText, maxFee === 75 && styles.activeSmallFilterText]}>
              Under {money(75, 0)}
            </Text>
          </TouchableOpacity>

          {(selectedSpecId !== undefined || minRating !== undefined || maxFee !== undefined || searchQuery.length > 0) && (
            <TouchableOpacity
              style={styles.clearBtn}
              onPress={() => {
                setSelectedSpecId(undefined);
                setMinRating(undefined);
                setMaxFee(undefined);
                setSearchQuery('');
              }}
            >
              <Text style={styles.clearBtnText}>Reset</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Doctor List */}
      {loading ? (
        <LoadingView message="Searching veterinary doctors..." />
      ) : (
        <FlatList
          data={doctors}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <DoctorCard
              doctor={item}
              onPress={() => navigation.navigate('DoctorProfile', { doctorId: item.id })}
              onBookPress={() => navigation.navigate('BookAppointment', { doctorId: item.id })}
            />
          )}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
          }
          ListEmptyComponent={
            <EmptyState
              icon="search-outline"
              title="No Veterinarians Found"
              message={
                myCity
                  ? `No approved veterinarians matched near ${myCity}. Try other filters${hasGps ? ', a wider distance' : ''}, or update your location.`
                  : 'Add your city in your profile so we can show veterinarians near you.'
              }
              actionTitle={myCity ? 'Clear Filters' : 'Set My Location'}
              onAction={() => {
                if (!myCity) {
                  navigation.navigate('Profile');
                  return;
                }
                setSelectedSpecId(undefined);
                setMinRating(undefined);
                setMaxFee(undefined);
                setSearchQuery('');
              }}
            />
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, marginBottom: 4 },
  locationText: { flex: 1, fontSize: 13, fontWeight: '700', color: colors.text },
  locationChange: { fontSize: 13, fontWeight: '700', color: colors.primary },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  searchHeader: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
  },
  filterScroll: {
    gap: 8,
    paddingVertical: 4,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
  },
  activeFilterChip: {
    backgroundColor: colors.primary,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  activeFilterChipText: {
    color: '#FFFFFF',
  },
  quickFiltersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },
  smallFilter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#FFFFFF',
  },
  activeSmallFilter: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  smallFilterText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  activeSmallFilterText: {
    color: '#FFFFFF',
  },
  clearBtn: {
    marginLeft: 'auto',
    paddingHorizontal: 8,
  },
  clearBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.danger,
  },
  listContent: {
    padding: 16,
  },
});
