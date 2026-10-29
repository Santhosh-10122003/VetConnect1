import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors } from '../../theme/colors';
import { AppHeader } from '../../components/common/AppHeader';
import { KeyboardScroll } from '../../components/common/KeyboardScroll';
import { AppInput } from '../../components/common/AppInput';
import { AppButton } from '../../components/common/AppButton';
import { authApi } from '../../api/authApi';
import { useAuth } from '../../context/AuthContext';
import { AuthStackParamList } from '../../navigation/types';
import { getErrorMessage, notify } from '../../utils/helpers';

type Props = NativeStackScreenProps<AuthStackParamList, 'VerifyOtp'>;

const RESEND_SECONDS = 30;

export const VerifyOtpScreen: React.FC<Props> = ({ navigation, route }) => {
  const { mobile } = route.params;
  const { verifyOtp } = useAuth();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);

  // A code has just been sent (sign-up or blocked login), so the resend button starts on cooldown.
  useEffect(() => {
    if (secondsLeft <= 0) return;
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secondsLeft]);

  const submit = async () => {
    const trimmed = code.trim();
    if (!/^\d{6}$/.test(trimmed)) {
      setError('Enter the 6-digit code we sent to your mobile.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      // On success the auth context signs the user in and the navigator switches to their home screen.
      await verifyOtp(mobile, trimmed);
    } catch (e) {
      setError(getErrorMessage(e, 'Verification failed. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    setResending(true);
    try {
      await authApi.resendOtp(mobile);
      setSecondsLeft(RESEND_SECONDS);
      setError(null);
      notify('Code sent', `We sent a new code to ${mobile}.`);
    } catch (e) {
      notify('Could not resend', getErrorMessage(e));
    } finally {
      setResending(false);
    }
  };

  return (
    <View style={styles.container}>
      <AppHeader title="Verify your mobile number" showBack onBack={() => navigation.goBack()} />
      <KeyboardScroll contentContainerStyle={styles.content}>
        <Text style={styles.title}>Enter the 6-digit code</Text>
        <Text style={styles.instructions}>
          We sent a verification code by text message to {mobile}. It expires in 10 minutes.
        </Text>

        <AppInput
          label="Verification code"
          placeholder="123456"
          value={code}
          onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
          keyboardType="number-pad"
          maxLength={6}
          error={error ?? undefined}
          icon="keypad-outline"
        />

        <AppButton title="Verify & Continue" onPress={submit} loading={loading} style={styles.btn} />
        <AppButton
          title={secondsLeft > 0 ? `Resend code in ${secondsLeft}s` : 'Resend code'}
          variant="outline"
          onPress={resend}
          loading={resending}
          disabled={secondsLeft > 0}
          style={styles.btn}
        />
      </KeyboardScroll>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20 },
  title: { fontSize: 22, fontWeight: '800', color: colors.text, marginBottom: 8 },
  instructions: { fontSize: 14, color: colors.textSecondary, lineHeight: 20, marginBottom: 20 },
  btn: { marginTop: 12 },
});
