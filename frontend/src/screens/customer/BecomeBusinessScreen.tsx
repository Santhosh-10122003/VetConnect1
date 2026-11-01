import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors } from '../../theme/colors';
import { shared } from '../../theme/shared';
import { accountApi } from '../../api/accountApi';
import { AppHeader } from '../../components/common/AppHeader';
import { KeyboardScroll } from '../../components/common/KeyboardScroll';
import { ProviderForm, emptyProviderForm, toPayload } from '../../components/care/ProviderForm';
import { CustomerStackParamList } from '../../navigation/types';
import { useAuth } from '../../context/AuthContext';
import { confirmAction, getErrorMessage, notify } from '../../utils/helpers';

type Props = NativeStackScreenProps<CustomerStackParamList, 'BecomeBusiness'>;

/** A pet owner who runs a pet-care business turns this account into a business account. */
export const BecomeBusinessScreen: React.FC<Props> = ({ navigation }) => {
  const { logout } = useAuth();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <View style={shared.screen}>
      <AppHeader title="Pet-care business" showBack onBack={() => navigation.goBack()} />
      <KeyboardScroll contentContainerStyle={shared.content} keyboardShouldPersistTaps="handled">
        <View style={styles.note} testID="become-business-note">
          <Text style={styles.noteTitle}>Before you continue</Text>
          <Text style={styles.noteText}>
            This account becomes a pet-care business account, and the app will open as a business after you sign in again. Your pets and
            history are kept. An admin reviews the business before it is listed. You can't do this while you have upcoming bookings.
          </Text>
        </View>
        <ProviderForm
          initial={emptyProviderForm}
          submitLabel="Send for approval"
          saving={saving}
          error={error}
          onSubmit={async (values) => {
            if (!(await confirmAction('Switch to a business account', 'This account will open as a pet-care business from now on. Continue?', 'Switch'))) return;
            setSaving(true);
            setError(null);
            try {
              await accountApi.becomeBusiness(toPayload(values));
              notify('Sent for approval', 'Sign in again to open your pet-care business. Upload your trade licence from its Profile while the admin reviews it.');
              await logout();
            } catch (e) {
              setError(getErrorMessage(e, 'Could not create the business.'));
            } finally {
              setSaving(false);
            }
          }}
        />
      </KeyboardScroll>
    </View>
  );
};

const styles = StyleSheet.create({
  note: { backgroundColor: colors.mint, borderRadius: 16, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: colors.mintDark },
  noteTitle: { fontSize: 13, fontWeight: '800', color: colors.primary },
  noteText: { fontSize: 12, color: colors.textSecondary, lineHeight: 18, marginTop: 4 },
});
