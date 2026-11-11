import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { AppInput } from './AppInput';
import { accountApi } from '../../api/accountApi';
import { useAuth } from '../../context/AuthContext';
import { confirmAction, getErrorMessage, notify } from '../../utils/helpers';
import { themedStyles } from '../../theme/themed';

/** "Delete my account": asks for the password, then a last confirmation, then signs out. */
export const DeleteAccountCard: React.FC = () => {
  const { logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remove = async () => {
    if (!password) return setError('Enter your password to continue.');
    if (!(await confirmAction('Delete account', 'Your account and personal details will be deleted for good. This cannot be undone.', 'Delete', true))) return;
    setBusy(true);
    setError(null);
    try {
      await accountApi.deleteMine(password);
      notify('Account deleted', 'Your account has been deleted.');
      await logout();
    } catch (e) {
      setError(getErrorMessage(e, 'Could not delete your account.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.wrap} testID="delete-account-card">
      {!open ? (
        <TouchableOpacity style={styles.link} onPress={() => setOpen(true)} activeOpacity={0.8} testID="delete-account-open">
          <Ionicons name="trash-outline" size={16} color={colors.danger} />
          <Text style={styles.linkText}>Delete my account</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.box}>
          <Text style={styles.title}>Delete your account</Text>
          <Text style={styles.text}>
            This removes your name, number, address, pets' details and sign-in for good. You can't delete while you have upcoming bookings
            or money in your wallet that has not been paid out.
          </Text>
          <AppInput label="Your password" placeholder="Enter your password" value={password} onChangeText={(v) => { setPassword(v); setError(null); }} isPassword icon="lock-closed-outline" testID="delete-account-password" />
          {!!error && <Text style={styles.error} testID="delete-account-error">{error}</Text>}
          <View style={styles.row}>
            <TouchableOpacity style={[styles.btn, styles.cancel]} onPress={() => { setOpen(false); setPassword(''); setError(null); }} activeOpacity={0.85}>
              <Text style={[styles.btnText, { color: colors.text }]}>Keep my account</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.danger, busy && { opacity: 0.6 }]} onPress={remove} disabled={busy} activeOpacity={0.85} testID="delete-account-confirm">
              <Text style={styles.btnText}>{busy ? 'Deleting...' : 'Delete'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = themedStyles(() => ({
  wrap: { marginTop: 18, marginBottom: 30 },
  link: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10 },
  linkText: { color: colors.danger, fontWeight: '700', fontSize: 13 },
  box: { borderWidth: 1, borderColor: colors.danger, borderRadius: 18, padding: 14, backgroundColor: colors.dangerBg },
  title: { fontSize: 15, fontWeight: '800', color: colors.danger },
  text: { fontSize: 12, color: colors.textSecondary, lineHeight: 17, marginTop: 4, marginBottom: 12 },
  error: { color: colors.danger, fontSize: 13, marginBottom: 8 },
  row: { flexDirection: 'row', gap: 10 },
  btn: { flex: 1, borderRadius: 14, paddingVertical: 12, alignItems: 'center' },
  cancel: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  danger: { backgroundColor: colors.danger },
  btnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
}));
