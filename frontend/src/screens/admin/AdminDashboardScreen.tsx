import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { shared } from '../../theme/shared';
import { adminApi, AdminStats } from '../../api/adminApi';
import { useAuth } from '../../context/AuthContext';
import { AppHeader } from '../../components/common/AppHeader';
import { AppButton } from '../../components/common/AppButton';
import { LoadingView } from '../../components/common/LoadingView';
import { AdminStackParamList } from '../../navigation/types';
import { confirmAction, getErrorMessage, notify } from '../../utils/helpers';

type Props = NativeStackScreenProps<AdminStackParamList, 'AdminDashboard'>;

export const AdminDashboardScreen: React.FC<Props> = ({ navigation }) => {
  const { logout } = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setStats((await adminApi.getDashboardStats()).data);
    } catch (e) {
      notify('Error', getErrorMessage(e));
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const signOut = async () => {
    if (await confirmAction('Sign out', 'You will need to sign in again.', 'Sign out', true)) await logout();
  };

  if (!stats) return <LoadingView />;

  const tiles: { label: string; value: number; icon: keyof typeof Ionicons.glyphMap; tint: string }[] = [
    { label: 'Customers', value: stats.totalCustomers, icon: 'people-outline', tint: colors.info },
    { label: 'Doctors', value: stats.totalDoctors, icon: 'medkit-outline', tint: colors.primary },
    { label: 'Pets', value: stats.totalPets, icon: 'paw-outline', tint: colors.secondary },
    { label: 'Appointments', value: stats.totalAppointments, icon: 'calendar-outline', tint: colors.primaryLight },
    { label: 'Pending bookings', value: stats.pendingAppointments, icon: 'hourglass-outline', tint: colors.warning },
    { label: 'Completed', value: stats.completedAppointments, icon: 'checkmark-done-outline', tint: colors.success },
    { label: 'Reviews', value: stats.totalReviews, icon: 'star-outline', tint: colors.star },
  ];

  return (
    <View style={shared.screen}>
      <AppHeader title="Admin Overview" subtitle="Platform analytics" rightAction={{ icon: 'log-out-outline', onPress: signOut }} />
      <ScrollView
        contentContainerStyle={shared.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        <TouchableOpacity style={styles.queue} onPress={() => navigation.navigate('DoctorVerification', { mode: 'new' })} activeOpacity={0.9}>
          <Ionicons name="shield-checkmark" size={28} color="#FFFFFF" />
          <View style={{ flex: 1 }}>
            <Text style={styles.queueTitle}>Verification queue</Text>
            <Text style={styles.queueSub}>
              {stats.pendingDoctorVerifications} doctor{stats.pendingDoctorVerifications === 1 ? '' : 's'} awaiting review
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color="#FFFFFF" />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.queue, styles.queueResubmitted]}
          onPress={() => navigation.navigate('DoctorVerification', { mode: 'resubmitted' })}
          activeOpacity={0.9}
        >
          <Ionicons name="refresh-circle" size={28} color="#FFFFFF" />
          <View style={{ flex: 1 }}>
            <Text style={styles.queueTitle}>Re-approval requests</Text>
            <Text style={styles.queueSub}>
              {stats.resubmittedDoctorVerifications} doctor{stats.resubmittedDoctorVerifications === 1 ? '' : 's'} updated details after a rejection
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color="#FFFFFF" />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.queue, styles.queuePet]}
          onPress={() => navigation.navigate('DoctorVerification', { mode: 'new', kind: 'provider' })}
          activeOpacity={0.9}
          testID="queue-providers-new"
        >
          <Ionicons name="cut" size={28} color="#FFFFFF" />
          <View style={{ flex: 1 }}>
            <Text style={styles.queueTitle}>Pet care queue</Text>
            <Text style={styles.queueSub}>
              {stats.pendingProviderVerifications} business{stats.pendingProviderVerifications === 1 ? '' : 'es'} awaiting review
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color="#FFFFFF" />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.queue, styles.queuePetAgain]}
          onPress={() => navigation.navigate('DoctorVerification', { mode: 'resubmitted', kind: 'provider' })}
          activeOpacity={0.9}
          testID="queue-providers-resubmitted"
        >
          <Ionicons name="refresh-circle" size={28} color="#FFFFFF" />
          <View style={{ flex: 1 }}>
            <Text style={styles.queueTitle}>Pet care re-approvals</Text>
            <Text style={styles.queueSub}>
              {stats.resubmittedProviderVerifications} business{stats.resubmittedProviderVerifications === 1 ? '' : 'es'} updated details after a rejection
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color="#FFFFFF" />
        </TouchableOpacity>

        <View style={styles.grid}>
          {tiles.map((t) => (
            <View key={t.label} style={styles.tile}>
              <Ionicons name={t.icon} size={22} color={t.tint} />
              <Text style={styles.value}>{t.value}</Text>
              <Text style={styles.label}>{t.label}</Text>
            </View>
          ))}
        </View>

        <AppButton title="Sign Out" variant="outline" onPress={signOut} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  queue: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.primary, borderRadius: 16, padding: 18, marginBottom: 16 },
  queueResubmitted: { backgroundColor: colors.warning },
  queuePet: { backgroundColor: colors.secondary },
  queuePetAgain: { backgroundColor: colors.info },
  queueTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '800' },
  queueSub: { color: colors.mintDark, fontSize: 13, marginTop: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  tile: { flexGrow: 1, flexBasis: '45%', backgroundColor: colors.card, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: colors.border },
  value: { fontSize: 26, fontWeight: '800', color: colors.text, marginTop: 6 },
  label: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
});
