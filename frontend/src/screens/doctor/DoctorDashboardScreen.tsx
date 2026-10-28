import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { CompositeScreenProps, useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { shared } from '../../theme/shared';
import { doctorApi, DoctorProfile } from '../../api/doctorApi';
import { Appointment } from '../../api/appointmentApi';
import { AppHeader } from '../../components/common/AppHeader';
import { AppointmentCard } from '../../components/appointment/AppointmentCard';
import { EmptyState } from '../../components/common/EmptyState';
import { LoadingView } from '../../components/common/LoadingView';
import { DoctorStackParamList, DoctorTabParamList } from '../../navigation/types';
import { drName, getErrorMessage, money, notify, todayIso } from '../../utils/helpers';

type Props = CompositeScreenProps<
  BottomTabScreenProps<DoctorTabParamList, 'DoctorDashboard'>,
  NativeStackScreenProps<DoctorStackParamList>
>;

const Stat: React.FC<{ icon: keyof typeof Ionicons.glyphMap; value: string | number; label: string; tint: string; onPress?: () => void }> = ({
  icon,
  value,
  label,
  tint,
  onPress,
}) => (
  <TouchableOpacity style={styles.stat} onPress={onPress} disabled={!onPress} activeOpacity={0.85}>
    <Ionicons name={icon} size={22} color={tint} />
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </TouchableOpacity>
);

export const DoctorDashboardScreen: React.FC<Props> = ({ navigation }) => {
  const [doctor, setDoctor] = useState<DoctorProfile | null>(null);
  const [appts, setAppts] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [d, a] = await Promise.all([doctorApi.getMyDoctorProfile(), doctorApi.getDoctorAppointments(undefined, 0, 200)]);
      setDoctor(d.data);
      setAppts(a.data.content);
    } catch (e) {
      notify('Error', getErrorMessage(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading || !doctor) return <LoadingView />;

  const today = todayIso();
  const todays = appts
    .filter((a) => a.appointmentDate === today && (a.status === 'CONFIRMED' || a.status === 'PENDING' || a.status === 'COMPLETED'))
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
  const pending = appts.filter((a) => a.status === 'PENDING').length;
  const month = today.substring(0, 7);
  const completedThisMonth = appts.filter((a) => a.status === 'COMPLETED' && a.appointmentDate.startsWith(month));
  const earnings = completedThisMonth.reduce((sum, a) => sum + (a.consultationFee || 0), 0);

  return (
    <View style={shared.screen}>
      <AppHeader
        title={drName(doctor.fullName)}
        subtitle="Today's dashboard"
        rightAction={{ icon: 'notifications-outline', onPress: () => navigation.navigate('DoctorNotifications') }}
      />
      <ScrollView
        contentContainerStyle={shared.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        {doctor.verificationStatus !== 'APPROVED' && (
          <View style={styles.banner}>
            <Ionicons name="time-outline" size={20} color={colors.warning} />
            <View style={{ flex: 1 }}>
              <Text style={styles.bannerText}>
                {doctor.verificationStatus === 'PENDING'
                  ? 'Your profile is awaiting admin verification. Patients cannot book you until you are approved.'
                  : doctor.verificationStatus === 'RESUBMITTED'
                    ? 'Your updated profile has been sent for another review. We will notify you with the result.'
                    : 'Your profile was rejected. Open Profile to see the reason, fix your details and send it for approval again.'}
              </Text>
              {doctor.verificationStatus === 'REJECTED' && !!doctor.verificationReason && (
                <Text style={[styles.bannerText, { fontWeight: '800', marginTop: 6 }]}>Reason: {doctor.verificationReason}</Text>
              )}
            </View>
          </View>
        )}

        <View style={styles.stats}>
          <Stat icon="today-outline" value={todays.length} label="Today" tint={colors.primary} />
          <Stat
            icon="hourglass-outline"
            value={pending}
            label="Pending requests"
            tint={colors.warning}
            onPress={() => navigation.navigate('DoctorAppointments', { initialStatus: 'PENDING' })}
          />
          <Stat icon="checkmark-done-outline" value={completedThisMonth.length} label="Completed (month)" tint={colors.success} />
          <Stat icon="cash-outline" value={money(earnings, 0)} label="Consult. fees (month)" tint={colors.info} />
        </View>

        <Text style={shared.sectionTitle}>Today's schedule</Text>
        {todays.length === 0 ? (
          <EmptyState icon="calendar-outline" title="Nothing scheduled today" message="Confirmed and pending visits for today will appear here." />
        ) : (
          todays.map((a) => (
            <AppointmentCard
              key={a.id}
              appointment={a}
              isDoctorView
              onPress={() => navigation.navigate('DoctorAppointmentDetails', { appointmentId: a.id })}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    gap: 10,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginBottom: 16,
  },
  bannerText: { flex: 1, fontSize: 13, color: '#92400E', lineHeight: 18 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  stat: {
    flexGrow: 1,
    flexBasis: '45%',
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statValue: { fontSize: 24, fontWeight: '800', color: colors.text, marginTop: 6 },
  statLabel: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
});
