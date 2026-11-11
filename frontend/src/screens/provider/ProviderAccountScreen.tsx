import React from 'react';
import { View, Text } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { shared } from '../../theme/shared';
import { themedStyles } from '../../theme/themed';
import { useAuth } from '../../context/AuthContext';
import { AppHeader } from '../../components/common/AppHeader';
import { AppButton } from '../../components/common/AppButton';
import { KeyboardScroll } from '../../components/common/KeyboardScroll';
import { DeleteAccountCard } from '../../components/common/DeleteAccountCard';
import { confirmAction } from '../../utils/helpers';
import { ProviderStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<ProviderStackParamList, 'ProviderAccount'>;

/** Signing out and deleting the account live here, away from the everyday business screens. */
export const ProviderAccountScreen: React.FC<Props> = ({ navigation }) => {
  const { user, logout } = useAuth();

  const signOut = async () => {
    if (await confirmAction('Sign out', 'You will need to sign in again.', 'Sign out', true)) await logout();
  };

  return (
    <View style={shared.screen}>
      <AppHeader title="Account" subtitle="Sign out or delete your account" showBack onBack={() => navigation.goBack()} />
      <KeyboardScroll contentContainerStyle={shared.content}>
        <View style={styles.who}>
          <View style={styles.avatar}><Ionicons name="storefront" size={26} color={colors.primary} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name} numberOfLines={1}>{user?.fullName || 'Pet-care business'}</Text>
            <Text style={styles.sub}>Signed in to your pet-care business</Text>
          </View>
        </View>

        <Text style={styles.section}>Sign out</Text>
        <Text style={styles.help}>You will need your mobile number and password to sign in again.</Text>
        <AppButton title="Sign Out" variant="outline" textStyle={{ color: colors.danger }} style={{ borderColor: colors.danger, marginBottom: 24 }} onPress={signOut} testID="account-signout" />

        <Text style={styles.section}>Delete my account</Text>
        <Text style={styles.help}>This removes your business and personal details for good.</Text>
        <DeleteAccountCard />
      </KeyboardScroll>
    </View>
  );
};

const styles = themedStyles(() => ({
  who: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.card, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: colors.border, marginBottom: 24 },
  avatar: { width: 52, height: 52, borderRadius: 18, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 17, fontWeight: '800', color: colors.text },
  sub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  section: { fontSize: 16, fontWeight: '800', color: colors.text, marginBottom: 4 },
  help: { fontSize: 13, color: colors.textSecondary, marginBottom: 12, lineHeight: 18 },
}));
