import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, RefreshControl, TouchableOpacity } from 'react-native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { CompositeScreenProps, useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { shared } from '../../theme/shared';
import { appointmentApi, Appointment } from '../../api/appointmentApi';
import { AppHeader } from '../../components/common/AppHeader';
import { AppointmentCard } from '../../components/appointment/AppointmentCard';
import { EmptyState } from '../../components/common/EmptyState';
import { LoadingView } from '../../components/common/LoadingView';
import { CustomerStackParamList, CustomerTabParamList } from '../../navigation/types';
import { confirmAction, getErrorMessage, notify, drName } from '../../utils/helpers';

type Props = CompositeScreenProps<
  BottomTabScreenProps<CustomerTabParamList, 'Appointments'>,
  NativeStackScreenProps<CustomerStackParamList>
>;

type Tab = 'UPCOMING' | 'COMPLETED' | 'CANCELLED';
const TABS: Tab[] = ['UPCOMING', 'COMPLETED', 'CANCELLED'];

export const MyAppointmentsScreen: React.FC<Props> = ({ navigation, route }) => {
  const [tab, setTab] = useState<Tab>(route.params?.initialTab ?? 'UPCOMING');
  const [items, setItems] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (route.params?.initialTab) setTab(route.params.initialTab);
  }, [route.params?.initialTab]);

  const load = useCallback(async () => {
    try {
      const res = await appointmentApi.getMyAppointments(tab, 0, 50);
      setItems(res.data.content);
    } catch (e) {
      notify('Error', getErrorMessage(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tab]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load])
  );

  const cancel = async (a: Appointment) => {
    try {
      const preview = await appointmentApi.cancellationPreview(a.id);
      if (!(await confirmAction('Cancel appointment', `Cancel ${a.bookingReference} with ${drName(a.doctorName)}?\n\n${preview.message}`, 'Cancel appointment', true))) return;
      await appointmentApi.cancelAppointment(a.id, 'Cancelled by customer');
      load();
    } catch (e) {
      notify('Could not cancel', getErrorMessage(e));
    }
  };

  return (
    <View style={shared.screen}>
      <AppHeader title="My Appointments" />
      <View style={shared.segment}>
        {TABS.map((t) => (
          <TouchableOpacity key={t} style={[shared.segmentItem, tab === t && shared.segmentItemActive]} onPress={() => setTab(t)}>
            <Text style={[shared.segmentText, tab === t && shared.segmentTextActive]}>
              {t.charAt(0) + t.slice(1).toLowerCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <LoadingView />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => String(i.id)}
          contentContainerStyle={shared.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          ListEmptyComponent={
            <EmptyState
              icon="calendar-outline"
              title={`No ${tab.toLowerCase()} appointments`}
              message="Book a consultation with a verified veterinarian."
              actionTitle={tab === 'UPCOMING' ? 'Find a Doctor' : undefined}
              onAction={() => navigation.navigate('FindDoctors')}
            />
          }
          renderItem={({ item }) => (
            <AppointmentCard
              appointment={item}
              onPress={() => (item.status === 'AWAITING_PAYMENT'
                ? navigation.navigate('AppointmentPayment', { appointmentId: item.id })
                : navigation.navigate('AppointmentDetails', { appointmentId: item.id }))}
              onCancelPress={() => cancel(item)}
              onReviewPress={() =>
                navigation.navigate('AddReview', { doctorId: item.doctorId, doctorName: item.doctorName, appointmentId: item.id })
              }
            />
          )}
        />
      )}
    </View>
  );
};
