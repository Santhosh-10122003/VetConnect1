import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { CompositeScreenProps, useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { shared } from '../../theme/shared';
import { doctorApi } from '../../api/doctorApi';
import { Appointment } from '../../api/appointmentApi';
import { AppHeader } from '../../components/common/AppHeader';
import { AppointmentCard } from '../../components/appointment/AppointmentCard';
import { EmptyState } from '../../components/common/EmptyState';
import { LoadingView } from '../../components/common/LoadingView';
import { DoctorStackParamList, DoctorTabParamList } from '../../navigation/types';
import { getErrorMessage, notify } from '../../utils/helpers';

type Props = CompositeScreenProps<
  BottomTabScreenProps<DoctorTabParamList, 'DoctorAppointments'>,
  NativeStackScreenProps<DoctorStackParamList>
>;

// The API groups statuses into tabs, so filtering by individual status happens client-side.
const FILTERS: { key: string; label: string; match: (a: Appointment) => boolean }[] = [
  { key: 'PENDING', label: 'Pending', match: (a) => a.status === 'PENDING' || (!!a.rescheduleRequest && ['PENDING', 'CONFIRMED'].includes(a.status)) },
  { key: 'CONFIRMED', label: 'Confirmed', match: (a) => a.status === 'CONFIRMED' },
  { key: 'COMPLETED', label: 'Completed', match: (a) => a.status === 'COMPLETED' },
  { key: 'CANCELLED', label: 'Cancelled', match: (a) => ['CANCELLED', 'REJECTED', 'NO_SHOW'].includes(a.status) },
];

export const DoctorAppointmentsScreen: React.FC<Props> = ({ navigation, route }) => {
  const [filter, setFilter] = useState(route.params?.initialStatus ?? 'PENDING');
  const [all, setAll] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (route.params?.initialStatus) setFilter(route.params.initialStatus);
  }, [route.params?.initialStatus]);

  const load = useCallback(async () => {
    try {
      setAll((await doctorApi.getDoctorAppointments(undefined, 0, 200)).data.content);
    } catch (e) {
      notify('Error', getErrorMessage(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const active = FILTERS.find((f) => f.key === filter) ?? FILTERS[0];
  const items = all
    .filter(active.match)
    .sort((a, b) => `${a.appointmentDate}${a.startTime}`.localeCompare(`${b.appointmentDate}${b.startTime}`) * (filter === 'COMPLETED' || filter === 'CANCELLED' ? -1 : 1));

  return (
    <View style={shared.screen}>
      <AppHeader title="Appointments" />
      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ padding: 16, gap: 8 }}>
          {FILTERS.map((f) => {
            const count = all.filter(f.match).length;
            return (
              <TouchableOpacity key={f.key} style={[shared.chip, filter === f.key && shared.chipActive]} onPress={() => setFilter(f.key)}>
                <Text style={[shared.chipText, filter === f.key && shared.chipTextActive]}>
                  {f.label} ({count})
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {loading ? (
        <LoadingView />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(a) => String(a.id)}
          contentContainerStyle={[shared.content, { paddingTop: 0 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          ListEmptyComponent={<EmptyState icon="calendar-outline" title={`No ${active.label.toLowerCase()} appointments`} message="Pull down to refresh." />}
          renderItem={({ item }) => (
            <AppointmentCard
              appointment={item}
              isDoctorView
              onPress={() => navigation.navigate('DoctorAppointmentDetails', { appointmentId: item.id })}
            />
          )}
        />
      )}
    </View>
  );
};
