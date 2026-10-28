import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors } from '../../theme/colors';
import { AppHeader } from '../../components/common/AppHeader';
import { KeyboardScroll } from '../../components/common/KeyboardScroll';
import { AppInput } from '../../components/common/AppInput';
import { AppButton } from '../../components/common/AppButton';
import { authApi } from '../../api/authApi';
import { EmailField } from '../../components/common/EmailField';
import { emailError, normalizeEmail } from '../../utils/validators';
import { AuthStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>;

export const ForgotPasswordScreen: React.FC<Props> = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [attempted, setAttempted] = useState(false);

  const handleSubmit = async () => {
    setAttempted(true);
    if (emailError(email)) return;
    setLoading(true);
    try {
      await authApi.forgotPassword(normalizeEmail(email));
      setSent(true);
    } catch {
      setSent(true); // Always show sent for security
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <AppHeader title="Forgot Password" showBack onBack={() => navigation.goBack()} />
      <KeyboardScroll contentContainerStyle={styles.content}>
        {!sent ? (
          <>
            <Text style={styles.title}>Reset Your Password</Text>
            <Text style={styles.instructions}>
              Enter your email address and we will send you verification instructions to reset your password.
            </Text>

            <EmailField label="Registered Email" value={email} onChange={setEmail} forceError={attempted} testID="forgot-email" />

            <AppButton
              title="Send Reset Instructions"
              onPress={handleSubmit}
              loading={loading}
              style={styles.btn}
            />
          </>
        ) : (
          <View style={styles.successBox}>
            <Text style={styles.successTitle}>Instructions Sent!</Text>
            <Text style={styles.successText}>
              If an account exists for {email}, a reset code has been sent. Enter the code to choose a new password. The code expires in 30 minutes.
            </Text>
            <AppButton
              title="Enter New Password"
              onPress={() => navigation.navigate('ResetPassword', { email })}
              style={styles.btn}
            />
          </View>
        )}
      </KeyboardScroll>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    padding: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 8,
  },
  instructions: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: 24,
  },
  btn: {
    marginTop: 10,
  },
  successBox: {
    padding: 20,
    backgroundColor: colors.mint,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.mintBorder,
    alignItems: 'center',
  },
  successTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 8,
  },
  successText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
});
