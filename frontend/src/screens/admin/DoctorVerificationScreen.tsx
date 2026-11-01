import { ApplicantDocuments } from '../../components/common/DocumentsCard';
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
import { confirmAction, getErrorMessage, money, notify, visibleEmail } from '../../utils/helpers';

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
  /** When the admin last reviewed it: documents uploaded after this are new. */
  reviewedAt?: string;
  fields: [string, string][];
  /** How the admin can check the credentials. */
  checks: string[];
}

const fromDoctor = (d: DoctorProfile): Applicant => ({
  id: d.id,
  name: d.fullName,
  meta: d.specializations.map((s) => s.name).join(', ') || 'No specialization listed',
  reason: d.verificationReason,
  resubmitNote: d.resubmitNote,
  resubmittedAt: d.resubmittedAt,
  reviewedAt: d.reviewedAt,
  fields: [
    ['Degree', d.degree || '-'],
    ['Registration number', d.licenseNumber],
    ['State Veterinary Council', d.councilName || '-'],
    ['Clinic', `${d.clinicName ?? '-'}${d.clinicAddress ? ', ' + d.clinicAddress : ''}`],
    ['Location', [d.clinicCity, d.clinicPostalCode].filter(Boolean).join(' ') + (d.latitude != null ? ' (GPS saved)' : '')],
    ['Experience', `${d.yearsOfExperience} years`],
    ['Fee', money(d.consultationFee, 0)],
    ['Payment details', d.payoutComplete
      ? (d.payoutMethod === 'UPI' ? `UPI: ${d.upiId}` : `Bank: ${d.accountHolderName}, ${d.bankAccountMasked}, ${d.ifscCode}`)
      : 'Not added yet'],
    ['Contact', [d.phone, visibleEmail(d.email)].filter(Boolean).join(' · ')],
  ],
  checks: [
    'Ask for the full registered name, degree, registration number and council (shown above).',
    'Search the register on the website of the State Veterinary Council (for example TNSVC for Tamil Nadu) and confirm the registration is active.',
    'Legitimate clinics display the registration certificate or council number in the clinic and on their prescription pad.',
  ],
});

const fromProvider = (p: Provider): Applicant => ({
  id: p.id,
  name: p.businessName,
  meta: p.categories.map(categoryLabel).join(' · '),
  reason: p.verificationReason,
  resubmitNote: p.resubmitNote,
  resubmittedAt: p.resubmittedAt,
  reviewedAt: p.reviewedAt,
  fields: [
    ['About', p.description || '-'],
    ['Trade licence number', p.registrationNumber || '-'],
    ['Veterinarian they work with', [p.vetPartnerName, p.vetPartnerPhone].filter(Boolean).join(' · ') || '-'],
    ['Address', [p.address, p.city, p.state, p.country].filter(Boolean).join(', ')],
    ['Location', p.latitude != null ? 'Pinned on the map' : 'Not pinned'],
    ['Payment details', p.payoutComplete
      ? (p.payoutMethod === 'UPI' ? `UPI: ${p.upiId}` : `Bank: ${p.accountHolderName}, ${p.bankAccountMasked}, ${p.ifscCode}${p.bankName ? ', ' + p.bankName : ''}`)
      : 'MISSING: cannot be approved'],
    ['Contact', [p.phone, visibleEmail(p.email)].filter(Boolean).join(' · ')],
  ],
  checks: [
    'Ask for the trade licence number from the municipal corporation (shown above).',
    'Check the city or district municipal website, or its health or veterinary department, that the business holds a valid trade or commercial licence.',
    'A legitimate facility shares the name and contact of its on-call or partner veterinarian: call them to confirm the tie-up.',
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
    if (deciding.status === 'REJECTED' && !(await confirmAction('Reject application', `Reject this ${who}'s application? They will see your reason.`, 'Reject', true))) return;
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

                <ApplicantDocuments ownerType={providerMode ? 'PROVIDER' : 'DOCTOR'} ownerId={d.id} newSince={resubmittedMode ? d.reviewedAt : undefined} />

                <View style={styles.checks} testID="verify-steps">
                  <Text style={styles.checksTitle}>How to verify</Text>
                  {d.checks.map((c, i) => (
                    <Text key={i} style={styles.checkLine}>{i + 1}. {c}</Text>
                  ))}
                </View>

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
  checks: { marginTop: 12, padding: 12, borderRadius: 14, backgroundColor: colors.mint, borderWidth: 1, borderColor: colors.mintDark },
  checksTitle: { fontSize: 12, fontWeight: '800', color: colors.primary, marginBottom: 4 },
  checkLine: { fontSize: 12, color: colors.textSecondary, lineHeight: 17, marginTop: 3 },
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
