import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { colors } from '../../theme/colors';
import { shared } from '../../theme/shared';
import { adminApi } from '../../api/adminApi';
import { DoctorProfile } from '../../api/doctorApi';
import { Provider, categoryLabel } from '../../api/careApi';
import { AppHeader } from '../../components/common/AppHeader';
import { KeyboardAvoid } from '../../components/common/KeyboardScroll';
import { AppButton } from '../../components/common/AppButton';
import { AppInput } from '../../components/common/AppInput';
import { EmptyState } from '../../components/common/EmptyState';
import { LoadingView } from '../../components/common/LoadingView';
import { AdminStackParamList } from '../../navigation/types';
import { getErrorMessage, money, notify } from '../../utils/helpers';

type Props = NativeStackScreenProps<AdminStackParamList, 'DoctorVerification'>;

type Decision = 'APPROVED' | 'REJECTED';

/** What the review card needs, whether the applicant is a doctor or a pet-care business. */
interface Applicant {
  id: number;
  name: string;
  meta: string;
  reason?: string;
  resubmitNote?: string;
  resubmittedAt?: string;
  fields: [string, string][];
}

const fromDoctor = (d: DoctorProfile): Applicant => ({
  id: d.id,
  name: d.fullName,
  meta: d.specializations.map((s) => s.name).join(', ') || 'No specialization listed',
  reason: d.verificationReason,
  resubmitNote: d.resubmitNote,
  resubmittedAt: d.resubmittedAt,
  fields: [
    ['License', d.licenseNumber],
    ['Clinic', `${d.clinicName ?? '-'}${d.clinicAddress ? ', ' + d.clinicAddress : ''}`],
    ['Location', [d.clinicCity, d.clinicPostalCode].filter(Boolean).join(' ') + (d.latitude != null ? ' (GPS saved)' : '')],
    ['Experience', `${d.yearsOfExperience} years`],
    ['Fee', money(d.consultationFee, 0)],
    ['Contact', [d.email, d.phone].filter(Boolean).join(' · ')],
  ],
});

const fromProvider = (p: Provider): Applicant => ({
  id: p.id,
  name: p.businessName,
  meta: p.categories.map(categoryLabel).join(' · '),
  reason: p.verificationReason,
  resubmitNote: p.resubmitNote,
  resubmittedAt: p.resubmittedAt,
  fields: [
    ['About', p.description || '-'],
    ['Registration', p.registrationNumber || '-'],
    ['Address', [p.address, p.city, p.state, p.country].filter(Boolean).join(', ')],
    ['Location', p.latitude != null ? 'Pinned on the map' : 'Not pinned'],
    ['Contact', [p.email, p.phone].filter(Boolean).join(' · ')],
  ],
});

const formatWhen = (iso?: string) => (iso ? new Date(iso).toLocaleString() : '');

export const DoctorVerificationScreen: React.FC<Props> = ({ navigation, route }) => {
  // Two separate queues: first-time applicants, and doctors who fixed a rejected profile and asked again.
  const resubmittedMode = route.params?.mode === 'resubmitted';
  const providerMode = route.params?.kind === 'provider';
  const who = providerMode ? 'business' : 'doctor';

  const [doctors, setDoctors] = useState<Applicant[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  // The card currently asking for a reason, and the text typed so far.
  const [deciding, setDeciding] = useState<{ id: number; status: Decision } | null>(null);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState('');

  const load = useCallback(async () => {
    try {
      if (providerMode) {
        const res = resubmittedMode ? await adminApi.getResubmittedProviders() : await adminApi.getPendingProviders();
        setDoctors(res.data.map(fromProvider));
      } else {
        const res = resubmittedMode ? await adminApi.getResubmittedDoctors() : await adminApi.getPendingDoctors();
        setDoctors(res.data.map(fromDoctor));
      }
    } catch (e) {
      notify('Error', getErrorMessage(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [resubmittedMode, providerMode]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const startDecision = (d: Applicant, status: Decision) => {
    setDeciding({ id: d.id, status });
    setReason('');
    setReasonError('');
  };

  const submitDecision = async (d: Applicant) => {
    if (!deciding) return;
    const text = reason.trim();
    if (text.length < 3) {
      setReasonError(
        deciding.status === 'APPROVED'
          ? `Add a short note for the ${who}, e.g. what you checked.`
          : `Tell the ${who} why, so they know what to fix.`
      );
      return;
    }
    setBusyId(d.id);
    try {
      if (providerMode) await adminApi.updateProviderVerification(d.id, deciding.status, text);
      else await adminApi.updateDoctorVerification(d.id, deciding.status, text);
      setDoctors((list) => list.filter((x) => x.id !== d.id));
      setDeciding(null);
    } catch (e) {
      notify('Action failed', getErrorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <KeyboardAvoid style={shared.screen}>
      <AppHeader
        title={`${providerMode ? 'Pet Care: ' : ''}${resubmittedMode ? 'Re-approval Requests' : 'New Applications'}`}
        subtitle={resubmittedMode ? `Rejected ${who}s who updated their details` : `${providerMode ? 'Businesses' : 'Doctors'} awaiting first review`}
        showBack
        onBack={() => navigation.goBack()}
      />
      {loading ? (
        <LoadingView />
      ) : (
        <FlatList
          data={doctors}
          keyExtractor={(d) => String(d.id)}
          contentContainerStyle={shared.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          ListEmptyComponent={
            <EmptyState
              icon="shield-checkmark-outline"
              title="Queue is clear"
              message={resubmittedMode ? `No ${who}s are waiting for a second review.` : `No ${who}s are waiting for verification.`}
            />
          }
          renderItem={({ item: d }) => {
            const open = deciding?.id === d.id;
            return (
              <View style={shared.card}>
                <Text style={styles.name}>{d.name}</Text>
                <Text style={styles.meta}>{d.meta}</Text>

                {resubmittedMode && (
                  <View style={styles.history}>
                    <Text style={styles.historyTitle}>Previously rejected</Text>
                    <Text style={styles.historyText}>{d.reason || 'No reason recorded'}</Text>
                    {!!d.resubmitNote && (
                      <>
                        <Text style={[styles.historyTitle, { marginTop: 8 }]}>{providerMode ? "Business's note" : "Doctor's note"}</Text>
                        <Text style={styles.historyText}>{d.resubmitNote}</Text>
                      </>
                    )}
                    {!!d.resubmittedAt && <Text style={styles.when}>Resubmitted {formatWhen(d.resubmittedAt)}</Text>}
                  </View>
                )}

                {d.fields.map(([k, v]) => (
                  <View key={k} style={{ marginTop: 8 }}>
                    <Text style={shared.label}>{k}</Text>
                    <Text style={shared.value}>{v}</Text>
                  </View>
                ))}

                {open ? (
                  <View style={styles.reasonBox}>
                    <AppInput
                      label={deciding!.status === 'APPROVED' ? 'Note for the doctor (required)' : 'Reason for rejection (required)'}
                      placeholder={deciding!.status === 'APPROVED' ? 'e.g. License verified with the state board' : 'e.g. License photo is unreadable'}
                      value={reason}
                      onChangeText={(v) => { setReason(v); if (reasonError) setReasonError(''); }}
                      error={reasonError || undefined}
                      multiline
                      maxLength={1000}
                      style={{ height: 90, textAlignVertical: 'top', paddingTop: 12 }}
                    />
                    <View style={styles.actions}>
                      <AppButton title="Cancel" variant="outline" style={styles.btn} disabled={busyId === d.id} onPress={() => setDeciding(null)} />
                      <AppButton
                        title={deciding!.status === 'APPROVED' ? 'Confirm Approve' : 'Confirm Reject'}
                        style={styles.btn}
                        loading={busyId === d.id}
                        onPress={() => submitDecision(d)}
                      />
                    </View>
                  </View>
                ) : (
                  <View style={styles.actions}>
                    <AppButton title="Reject" variant="outline" style={styles.btn} onPress={() => startDecision(d, 'REJECTED')} />
                    <AppButton title="Approve" style={styles.btn} onPress={() => startDecision(d, 'APPROVED')} />
                  </View>
                )}
              </View>
            );
          }}
        />
      )}
    </KeyboardAvoid>
  );
};

const styles = StyleSheet.create({
  name: { fontSize: 17, fontWeight: '800', color: colors.text },
  meta: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  history: { backgroundColor: '#FEF2F2', borderRadius: 12, padding: 12, marginTop: 12 },
  historyTitle: { fontSize: 12, fontWeight: '800', color: colors.danger },
  historyText: { fontSize: 13, color: colors.text, marginTop: 2, lineHeight: 18 },
  when: { fontSize: 11, color: colors.textSecondary, marginTop: 8 },
  reasonBox: { marginTop: 16 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  btn: { flex: 1, height: 46 },
});
