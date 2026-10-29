import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { shared } from '../../theme/shared';
import { doctorApi, DoctorProfile } from '../../api/doctorApi';
import { useAuth } from '../../context/AuthContext';
import { AppHeader } from '../../components/common/AppHeader';
import { KeyboardScroll } from '../../components/common/KeyboardScroll';
import { AppInput } from '../../components/common/AppInput';
import { LocationPicker } from '../../components/common/LocationPicker';
import { OsmMap } from '../../components/common/OsmMap';
import { openDirections } from '../../utils/maps';
import { AppButton } from '../../components/common/AppButton';
import { PayoutFields, PayoutValues, emptyPayout, payoutErrors, payoutFromProvider, payoutPayload } from '../../components/care/PayoutFields';
import { LoadingView } from '../../components/common/LoadingView';
import { confirmAction, getErrorMessage, money, notify, getCurrencySymbol, visibleEmail } from '../../utils/helpers';

const VERIFY_COPY = {
  APPROVED: { label: 'Verified', icon: 'shield-checkmark' as const, color: colors.success, bg: '#ECFDF5', text: 'Your profile is visible to pet owners.' },
  PENDING: { label: 'Pending review', icon: 'time' as const, color: colors.warning, bg: '#FFFBEB', text: 'An admin is reviewing your license. You will be notified once approved.' },
  REJECTED: { label: 'Rejected', icon: 'close-circle' as const, color: colors.danger, bg: '#FEF2F2', text: 'Your profile was not approved. Fix the points below, then send it for approval again.' },
  RESUBMITTED: { label: 'Sent for re-approval', icon: 'refresh-circle' as const, color: colors.info, bg: '#EFF6FF', text: 'An admin is reviewing your updated details. You will be notified with the result.' },
};

export const DoctorProfileScreen: React.FC = () => {
  const { logout, updateUserData } = useAuth();
  const [doctor, setDoctor] = useState<DoctorProfile | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState<{
    fullName: string; phone: string; clinicName: string; clinicAddress: string;
    clinicCity: string; clinicPostalCode: string; clinicCountry: string; clinicState: string;
    countryCode?: string; stateCode?: string; latitude?: number; longitude?: number;
    yearsOfExperience: string; consultationFee: string; bio: string;
  }>({ fullName: '', phone: '', clinicName: '', clinicAddress: '', clinicCity: '', clinicPostalCode: '', clinicCountry: '', clinicState: '', yearsOfExperience: '', consultationFee: '', bio: '' });
  const [payout, setPayout] = useState<PayoutValues>(emptyPayout);
  const [note, setNote] = useState('');
  const [resubmitting, setResubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = (await doctorApi.getMyDoctorProfile()).data;
      setDoctor(d);
      setPayout(payoutFromProvider(d));
      setForm({
        fullName: d.fullName,
        phone: d.phone ?? '',
        clinicName: d.clinicName ?? '',
        clinicAddress: d.clinicAddress ?? '',
        clinicCity: d.clinicCity ?? '',
        clinicPostalCode: d.clinicPostalCode ?? '',
        clinicCountry: d.clinicCountry ?? '',
        clinicState: d.clinicState ?? '',
        latitude: d.latitude ?? undefined,
        longitude: d.longitude ?? undefined,
        yearsOfExperience: String(d.yearsOfExperience ?? 0),
        consultationFee: String(d.consultationFee ?? 0),
        bio: d.bio ?? '',
      });
    } catch (e) {
      notify('Error', getErrorMessage(e));
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const save = async () => {
    if (!doctor) return;
    const errs: Record<string, string> = {};
    if (!form.fullName.trim()) errs.fullName = 'Required';
    if (!form.clinicName.trim()) errs.clinicName = 'Required';
    if (!form.clinicAddress.trim()) errs.clinicAddress = 'Required';
    if (!form.clinicCity.trim()) errs.clinicCity = 'Required so pet owners nearby can find you';
    if (form.latitude == null) errs.pin = 'Pin your clinic on the map so pet owners can navigate to you.';
    if (!/^\d+$/.test(form.yearsOfExperience)) errs.yearsOfExperience = 'Whole number';
    if (Object.keys(payoutErrors(payout)).length) errs.payout = 'Add your payment details';
    if (form.consultationFee === '' || isNaN(Number(form.consultationFee)) || Number(form.consultationFee) < 0) errs.consultationFee = 'Valid amount';
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setSaving(true);
    try {
      const updated = await doctorApi.updateDoctorProfile({
        fullName: form.fullName.trim(),
        phone: form.phone.trim() || undefined,
        clinicName: form.clinicName.trim(),
        clinicAddress: form.clinicAddress.trim(),
        clinicCity: form.clinicCity.trim(),
        clinicPostalCode: form.clinicPostalCode.trim() || undefined,
        clinicCountry: form.clinicCountry || undefined,
        clinicState: form.clinicState || undefined,
        latitude: form.latitude,
        longitude: form.longitude,
        yearsOfExperience: Number(form.yearsOfExperience),
        consultationFee: Number(form.consultationFee),
        bio: form.bio.trim() || undefined,
        ...payoutPayload(payout),
        avatarUrl: doctor.avatarUrl,
        specializationIds: doctor.specializations.map((s) => s.id),
        // Keep the existing schedule: the endpoint treats a missing list as "no change" only if the backend does,
        // so resend what we loaded.
        availabilities: doctor.availabilities,
      } as any);
      setDoctor(updated.data);
      updateUserData({ fullName: updated.data.fullName });
      setEditing(false);
    } catch (e) {
      notify('Could not save', getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const resubmit = async () => {
    if (!(await confirmAction('Send for approval', 'An admin will review your updated details again.', 'Send'))) return;
    setResubmitting(true);
    try {
      const updated = await doctorApi.resubmitForApproval(note.trim() || undefined);
      setDoctor(updated.data);
      setNote('');
      notify('Sent', 'Your profile has been sent for another review.');
    } catch (e) {
      notify('Could not send', getErrorMessage(e));
    } finally {
      setResubmitting(false);
    }
  };

  const signOut = async () => {
    if (await confirmAction('Sign out', 'You will need to sign in again.', 'Sign out', true)) await logout();
  };

  if (!doctor) return <LoadingView />;
  const v = VERIFY_COPY[doctor.verificationStatus];
  const set = (k: keyof typeof form) => (val: string) => setForm((f) => ({ ...f, [k]: val }));

  return (
    <View style={shared.screen}>
      <AppHeader
        title="Profile & Verification"
        rightAction={{ icon: editing ? 'close' : 'create-outline', onPress: () => setEditing((x) => !x) }}
      />
      <KeyboardScroll contentContainerStyle={shared.content} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <View style={styles.avatar}>
            <Ionicons name="medkit" size={36} color="#FFFFFF" />
          </View>
          <Text style={styles.name}>{doctor.fullName}</Text>
          <Text style={styles.sub}>{doctor.specializations.map((s) => s.name).join(' · ') || 'General practice'}</Text>
          <View style={styles.rating}>
            <Ionicons name="star" size={14} color={colors.star} />
            <Text style={styles.ratingText}>
              {doctor.ratingAvg?.toFixed?.(1) ?? '0.0'} ({doctor.reviewCount} reviews)
            </Text>
          </View>
        </View>

        <View style={[styles.verify, { backgroundColor: v.bg }]}>
          <Ionicons name={v.icon} size={24} color={v.color} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.verifyTitle, { color: v.color }]}>{v.label}</Text>
            <Text style={styles.verifyText}>{v.text}</Text>
          </View>
        </View>

        {!!doctor.verificationReason && doctor.verificationStatus !== 'PENDING' && (
          <View style={[shared.card, doctor.verificationStatus === 'REJECTED' && styles.reasonCardRejected]}>
            <Text style={shared.label}>
              {doctor.verificationStatus === 'APPROVED' ? "Admin's note" : doctor.verificationStatus === 'RESUBMITTED' ? 'Reason for the earlier rejection' : 'Reason for rejection'}
            </Text>
            <Text style={shared.value}>{doctor.verificationReason}</Text>
            {!!doctor.reviewedAt && <Text style={styles.reviewedAt}>Reviewed {new Date(doctor.reviewedAt).toLocaleString()}</Text>}
          </View>
        )}

        {doctor.verificationStatus === 'RESUBMITTED' && !!doctor.resubmitNote && (
          <View style={shared.card}>
            <Text style={shared.label}>Your note to the admin</Text>
            <Text style={shared.value}>{doctor.resubmitNote}</Text>
          </View>
        )}

        {doctor.verificationStatus === 'REJECTED' && !editing && (
          <View style={shared.card}>
            <Text style={shared.label}>Fixed the issues?</Text>
            <Text style={styles.verifyText}>Tap the pencil above to edit your details, save them, then send your profile for approval again.</Text>
            <AppInput
              label="Note to the admin (optional)"
              placeholder="e.g. I re-uploaded a clear license number"
              value={note}
              onChangeText={setNote}
              multiline
              maxLength={1000}
              style={{ height: 80, textAlignVertical: 'top', paddingTop: 12 }}
            />
            <AppButton title="Send for Approval Again" onPress={resubmit} loading={resubmitting} />
          </View>
        )}

        {editing ? (
          <View style={shared.card}>
            <AppInput label="Full name" value={form.fullName} onChangeText={set('fullName')} error={errors.fullName} />
            <AppInput label="Phone" value={form.phone} onChangeText={set('phone')} keyboardType="phone-pad" />
            <AppInput label="Clinic name" value={form.clinicName} onChangeText={set('clinicName')} error={errors.clinicName} />
            <AppInput label="Clinic address" value={form.clinicAddress} onChangeText={set('clinicAddress')} error={errors.clinicAddress} />
            <LocationPicker
              pinRequired
              districtLabel="Clinic District / City *"
              value={{
                country: form.clinicCountry, countryCode: form.countryCode, state: form.clinicState, stateCode: form.stateCode,
                city: form.clinicCity, postalCode: form.clinicPostalCode, latitude: form.latitude, longitude: form.longitude,
              }}
              onChange={(l) => setForm((f) => ({
                ...f, clinicCountry: l.country, countryCode: l.countryCode, clinicState: l.state, stateCode: l.stateCode,
                clinicCity: l.city, clinicPostalCode: l.postalCode, latitude: l.latitude, longitude: l.longitude,
              }))}
              errors={{ city: errors.clinicCity, pin: errors.pin }}
            />
            <AppInput label="Years of experience" value={form.yearsOfExperience} onChangeText={set('yearsOfExperience')} keyboardType="number-pad" error={errors.yearsOfExperience} />
            <AppInput label={`Consultation fee (${getCurrencySymbol()})`} value={form.consultationFee} onChangeText={set('consultationFee')} keyboardType="decimal-pad" error={errors.consultationFee} />
            <PayoutFields value={payout} onChange={setPayout} showErrors={Object.keys(errors).length > 0} />
            <AppInput label="Bio" value={form.bio} onChangeText={set('bio')} multiline style={{ height: 100, textAlignVertical: 'top', paddingTop: 12 }} />
            <AppButton title="Save Changes" onPress={save} loading={saving} />
          </View>
        ) : (
          <View style={shared.card}>
            {[
              ['License number', doctor.licenseNumber],
              ['Clinic', doctor.clinicName],
              ['Address', doctor.clinicAddress],
              ['Location', [doctor.clinicCity, doctor.clinicState, doctor.clinicCountry, doctor.clinicPostalCode].filter(Boolean).join(', ') + (doctor.latitude != null ? ' (pinned on map)' : ' (not pinned yet)')],
              ['Experience', `${doctor.yearsOfExperience} years`],
              ['Consultation fee', money(doctor.consultationFee, 0)],
              ['Payment details', doctor.payoutComplete
                ? (doctor.payoutMethod === 'UPI' ? `UPI: ${doctor.upiId}` : `Bank: ${doctor.accountHolderName}, ${doctor.bankAccountMasked}, ${doctor.ifscCode}`)
                : 'Not added yet'],
              ['Email', visibleEmail(doctor.email)],
              ['Phone', doctor.phone],
              ['Bio', doctor.bio],
            ].map(([label, value]) => (
              <View key={label} style={{ marginBottom: 10 }}>
                <Text style={shared.label}>{label}</Text>
                <Text style={shared.value}>{value || '-'}</Text>
              </View>
            ))}
          </View>
        )}

        <AppButton title="Sign Out" variant="outline" textStyle={{ color: colors.danger }} style={{ borderColor: colors.danger }} onPress={signOut} />
      </KeyboardScroll>
    </View>
  );
};

const styles = StyleSheet.create({
  hero: { alignItems: 'center', marginBottom: 16 },
  avatar: { width: 84, height: 84, borderRadius: 42, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 20, fontWeight: '800', color: colors.text, marginTop: 10 },
  sub: { fontSize: 13, color: colors.textSecondary, marginTop: 2, textAlign: 'center' },
  rating: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  ratingText: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
  verify: { flexDirection: 'row', gap: 12, alignItems: 'center', padding: 14, borderRadius: 14, marginBottom: 14 },
  reasonCardRejected: { borderColor: colors.danger, borderWidth: 1 },
  reviewedAt: { fontSize: 11, color: colors.textSecondary, marginTop: 8 },
  verifyTitle: { fontSize: 15, fontWeight: '800' },
  verifyText: { fontSize: 12, color: colors.textSecondary, marginTop: 2, lineHeight: 17 },
});
