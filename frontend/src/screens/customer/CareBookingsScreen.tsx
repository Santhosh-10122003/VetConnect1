import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { colors } from '../../theme/colors';
import { shared } from '../../theme/shared';
import { careApi, CareBooking } from '../../api/careApi';
import { AppHeader } from '../../components/common/AppHeader';
import { EmptyState } from '../../components/common/EmptyState';
import { LoadingView } from '../../components/common/LoadingView';
import { BookingCard } from '../../components/care/BookingCard';
import { CustomerStackParamList } from '../../navigation/types';
import { money } from '../../utils/helpers';

type Props = NativeStackScreenProps<CustomerStackParamList, 'CareBookings'>;
type Tab = 'UPCOMING' | 'COMPLETED' | 'CANCELLED';
const TABS: { key: Tab; label: string }[] = [
  { key: 'UPCOMING', label: 'Upcoming' },
  { key: 'COMPLETED', label: 'Completed' },
  { key: 'CANCELLED', label: 'Cancelled' },
];

export const CareBookingsScreen: React.FC<Props> = ({ navigation }) => {
  const [tab, setTab] = useState<Tab>('UPCOMING');
  const [items, setItems] = useState<CareBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setItems((await careApi.myBookings(tab)).content);
    } catch (e) {
      console.warn('Error loading pet-care bookings', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tab]);
  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  const open = (b: CareBooking) =>
    b.status === 'AWAITING_PAYMENT'
      ? navigation.navigate('CarePayment', { bookingId: b.id })
      : navigation.navigate('CareBookingDetails', { bookingId: b.id });

  return (
    <View style={shared.screen}>
      <AppHeader title="My pet-care bookings" showBack onBack={() => navigation.goBack()} />
      <View style={styles.tabs}>
        {TABS.map((t) => (
          <TouchableOpacity key={t.key} style={[styles.tab, tab === t.key && styles.tabActive]} onPress={() => setTab(t.key)} testID={`care-tab-${t.key}`}>
            <Text style={[styles.tabText, tab === t.key && { color: '#FFFFFF' }]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {loading ? (
        <LoadingView />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(b) => String(b.id)}
          contentContainerStyle={shared.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} colors={[colors.primary]} />}
          renderItem={({ item }) => (
            <BookingCard booking={item} viewer="customer" onPress={() => open(item)}>
              <View style={styles.foot}>
                <Text style={styles.total}>{money(item.totalAmount)}</Text>
                {item.status === 'AWAITING_PAYMENT' && <Text style={styles.pay}>Pay advance to confirm</Text>}
              </View>
            </BookingCard>
          )}
          ListEmptyComponent={<EmptyState icon="paw-outline" title="No bookings here" message="Your grooming, boarding and training bookings will show up here." />}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', gap: 8, padding: 12, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: colors.border },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 12, backgroundColor: colors.background },
  tabActive: { backgroundColor: colors.primary },
  tabText: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
  foot: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8 },
  total: { fontSize: 14, fontWeight: '800', color: colors.primary },
  pay: { fontSize: 12, fontWeight: '700', color: colors.warning },
});
