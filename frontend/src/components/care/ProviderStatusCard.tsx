import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { shared } from '../../theme/shared';
import { AppButton } from '../common/AppButton';
import { AppInput } from '../common/AppInput';
import { careApi, Provider } from '../../api/careApi';
import { confirmAction, getErrorMessage, notify } from '../../utils/helpers';

const COPY = {
  APPROVED: { label: 'Approved', icon: 'shield-checkmark' as const, color: colors.success, bg: '#ECFDF5', text: 'Your business is visible to pet owners nearby.' },
  PENDING: { label: 'Pending review', icon: 'time' as const, color: colors.warning, bg: '#FFFBEB', text: 'An admin is reviewing your business. You will be notified once it is approved.' },
  REJECTED: { label: 'Rejected', icon: 'close-circle' as const, color: colors.danger, bg: '#FEF2F2', text: 'Your profile was not approved. Fix the points below, then send it for approval again.' },
  RESUBMITTED: { label: 'Sent for re-approval', icon: 'refresh-circle' as const, color: colors.info, bg: '#EFF6FF', text: 'An admin is reviewing your updated details. You will be notified with the result.' },
};

interface Props {
  profile: Provider;
  onChanged: (p: Provider) => void;
}

/** Where the business stands with the admins: status, their reason, and (when rejected) the way to ask again. */
export const ProviderStatusCard: React.FC<Props> = ({ profile, onChanged }) => {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const v = COPY[profile.verificationStatus];

  const resubmit = async () => {
    if (!(await confirmAction('Send for approval', 'An admin will review your updated details again.', 'Send'))) return;
    setBusy(true);
    try {
      onChanged(await careApi.resubmit(note.trim() || undefined));
      setNote('');
      notify('Sent', 'Your profile has been sent for another review.');
    } catch (e) {
      notify('Could not send', getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View>
      <View style={[styles.banner, { backgroundColor: v.bg }]}>
        <Ionicons name={v.icon} size={24} color={v.color} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: v.color }]}>{v.label}</Text>
          <Text style={styles.text}>{v.text}</Text>
        </View>
      </View>

      {!!profile.verificationReason && profile.verificationStatus !== 'PENDING' && (
        <View style={[shared.card, profile.verificationStatus === 'REJECTED' && styles.rejectedCard]}>
          <Text style={shared.label}>
            {profile.verificationStatus === 'APPROVED' ? "Admin's note" : profile.verificationStatus === 'RESUBMITTED' ? 'Reason for the earlier rejection' : 'Reason for rejection'}
          </Text>
          <Text style={shared.value}>{profile.verificationReason}</Text>
          {!!profile.reviewedAt && <Text style={styles.when}>Reviewed {new Date(profile.reviewedAt).toLocaleString()}</Text>}
        </View>
      )}

      {profile.verificationStatus === 'REJECTED' && (
        <View style={shared.card}>
          <Text style={shared.label}>Fixed the issues?</Text>
          <Text style={styles.text}>Edit your details under Business profile, then send it for approval again.</Text>
          <AppInput
            label="Note to the admin (optional)"
            placeholder="e.g. I added my licence number"
            value={note}
            onChangeText={setNote}
            multiline
            maxLength={1000}
            style={{ height: 80, textAlignVertical: 'top', paddingTop: 12 }}
          />
          <AppButton title="Send for Approval Again" onPress={resubmit} loading={busy} />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  banner: { flexDirection: 'row', gap: 12, alignItems: 'center', padding: 14, borderRadius: 14, marginBottom: 14 },
  title: { fontSize: 15, fontWeight: '800' },
  text: { fontSize: 12, color: colors.textSecondary, marginTop: 2, lineHeight: 17 },
  rejectedCard: { borderColor: colors.danger, borderWidth: 1 },
  when: { fontSize: 11, color: colors.textSecondary, marginTop: 8 },
});
