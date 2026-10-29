import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { AppButton } from '../../components/common/AppButton';
import { AppInput } from '../../components/common/AppInput';
import { useAuth } from '../../context/AuthContext';
import { AuthStackParamList } from '../../navigation/types';
import { getErrorMessage } from '../../utils/helpers';
import { PhoneField, phoneForServer } from '../../components/common/PhoneField';
import { phoneError } from '../../utils/validators';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export const LoginScreen: React.FC<Props> = ({ navigation }) => {
  const { login } = useAuth();
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!mobile.trim() || !password) {
      setError('Please enter both your mobile number and password.');
      return;
    }
    // an older account can still type the email it registered with
    const problem = mobile.includes('@') ? null : phoneError(mobile);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await login({ mobile: phoneForServer(mobile), password });
    } catch (err: any) {
      if (err.response?.status === 403 && err.response?.data?.data?.code === 'EMAIL_NOT_VERIFIED') {
        // Right password, but the sign-up code was never confirmed; the server has just sent a new one.
        navigation.navigate('VerifyOtp', { mobile: err.response?.data?.data?.mobile || phoneForServer(mobile) });
        return;
      }
      const msg = getErrorMessage(err, 'Login failed. Please check your credentials.');
      setError(msg);
      Alert.alert('Login Failed', msg);
    } finally {
      setLoading(false);
    }
  };

  const fillQuickAccount = (demoMobile: string, demoPass: string) => {
    setMobile(demoMobile);
    setPassword(demoPass);
    setError(null);
  };

  return (
    <KeyboardAvoidingView
      style={styles.keyboardView}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={styles.logoBadge}>
            <Ionicons name="paw" size={32} color={colors.primary} />
          </View>
          <Text style={styles.title}>Welcome Back</Text>
          <Text style={styles.subtitle}>Sign in to manage your pets and appointments</Text>
        </View>

        {/* Quick Demo Fill Buttons */}
        <View style={styles.demoBox}>
          <Text style={styles.demoTitle}>Quick Fill Demo Accounts:</Text>
          <View style={styles.demoButtonsRow}>
            <TouchableOpacity
              style={styles.demoChip}
              onPress={() => fillQuickAccount('+1 555-0201', 'Customer@1234')}
            >
              <Text style={styles.demoChipText}>Customer</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.demoChip}
              onPress={() => fillQuickAccount('+1 555-0111', 'Doctor@1234')}
            >
              <Text style={styles.demoChipText}>Doctor</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.demoChip}
              onPress={() => fillQuickAccount('+1 555-0100', 'Admin@1234')}
            >
              <Text style={styles.demoChipText}>Admin</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.form}>
          <PhoneField label="Mobile Number" value={mobile} onChange={setMobile} forceError={!!error} allowEmail testID="login-mobile" />

          <AppInput
            label="Password"
            placeholder="Enter your password"
            value={password}
            onChangeText={setPassword}
            isPassword
            icon="lock-closed-outline"
          />

          {error && <Text style={styles.errorMessage}>{error}</Text>}

          <TouchableOpacity
            style={styles.forgotBtn}
            onPress={() => navigation.navigate('ForgotPassword')}
          >
            <Text style={styles.forgotText}>Forgot password?</Text>
          </TouchableOpacity>

          <AppButton
            title="Sign In"
            onPress={handleLogin}
            loading={loading}
            style={styles.submitBtn}
          />

          <View style={styles.signupPrompt}>
            <Text style={styles.signupText}>Don't have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Register', undefined)}>
              <Text style={styles.signupLink}>Sign Up</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    padding: 24,
    justifyContent: 'center',
    flexGrow: 1,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 10,
  },
  logoBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.mint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: colors.mintBorder,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.text,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 6,
    textAlign: 'center',
  },
  demoBox: {
    backgroundColor: colors.mint,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.mintBorder,
    marginBottom: 20,
  },
  demoTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 8,
    textAlign: 'center',
  },
  demoButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  demoChip: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.mintDark,
  },
  demoChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  form: {
    marginTop: 4,
  },
  forgotBtn: {
    alignSelf: 'flex-end',
    marginBottom: 20,
  },
  forgotText: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '600',
  },
  errorMessage: {
    color: colors.danger,
    fontSize: 13,
    marginBottom: 12,
    textAlign: 'center',
  },
  submitBtn: {
    marginBottom: 20,
  },
  signupPrompt: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  signupText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  signupLink: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
});
