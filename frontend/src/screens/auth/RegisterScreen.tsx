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
import { colors } from '../../theme/colors';
import { AppButton } from '../../components/common/AppButton';
import { AppInput } from '../../components/common/AppInput';
import { EmailField } from '../../components/common/EmailField';
import { LocationPicker, LocationValue, LocationErrors, emptyLocation } from '../../components/common/LocationPicker';
import { emailError, passwordError, confirmPasswordError, normalizeEmail } from '../../utils/validators';
import { useAuth } from '../../context/AuthContext';
import { getCurrencySymbol, getErrorMessage } from '../../utils/helpers';
import { CATEGORIES, CareCategory } from '../../api/careApi';
import { AuthStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

export const RegisterScreen: React.FC<Props> = ({ navigation, route }) => {
  const { register } = useAuth();
  const [role, setRole] = useState<'ROLE_CUSTOMER' | 'ROLE_DOCTOR' | 'ROLE_PROVIDER'>(
    route.params?.defaultRole || 'ROLE_CUSTOMER'
  );

  // Common fields
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');

  // Customer fields
  const [location, setLocation] = useState<LocationValue>(emptyLocation);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [address, setAddress] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');

  // Doctor fields
  const [clinicName, setClinicName] = useState('');
  const [clinicAddress, setClinicAddress] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [yearsOfExp, setYearsOfExp] = useState('5');
  const [fee, setFee] = useState('60');
  const [bio, setBio] = useState('');

  // Pet-care business fields
  const [businessName, setBusinessName] = useState('');
  const [businessAbout, setBusinessAbout] = useState('');
  const [businessAddress, setBusinessAddress] = useState('');
  const [categories, setCategories] = useState<CareCategory[]>([]);
  const toggleCategory = (c: CareCategory) =>
    setCategories((cur) => (cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]));

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const locationErrors: LocationErrors = {};
  if (!location.country) locationErrors.country = 'Select a country';
  else if (!location.state) locationErrors.state = 'Select a state';
  else if (!location.city.trim()) locationErrors.city = 'Select a district';
  if (role !== 'ROLE_CUSTOMER' && location.latitude == null) locationErrors.pin = role === 'ROLE_DOCTOR'
    ? 'Pin your clinic on the map so pet owners can navigate to you.'
    : 'Pin your place on the map so pet owners can navigate to you.';

  const handleRegister = async () => {
    setSubmitted(true);
    if (!fullName.trim()) {
      setError('Please enter your full name.');
      return;
    }
    if (emailError(email) || passwordError(password) || confirmPasswordError(password, confirmPassword)) {
      setError('Please fix the highlighted fields.');
      return;
    }
    if (role === 'ROLE_PROVIDER') {
      if (!businessName.trim()) return setError('Please enter your business name.');
      if (categories.length === 0) return setError('Choose at least one service: grooming, boarding or training.');
      if (!businessAddress.trim()) return setError('Please enter your street address.');
    }
    if (Object.keys(locationErrors).length) {
      setError(role === 'ROLE_CUSTOMER'
        ? 'Please choose your country, state and district so we can show you veterinarians near you.'
        : role === 'ROLE_PROVIDER'
        ? 'Please choose your business location and pin it on the map so pet owners can find and navigate to you.'
        : 'Please choose your clinic location and pin it on the map so pet owners can find and navigate to you.');
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const result = await register({
        role,
        fullName: fullName.trim(),
        email: normalizeEmail(email),
        password,
        confirmPassword,
        phone: phone.trim() || undefined,
        city: role !== 'ROLE_DOCTOR' ? location.city.trim() : undefined,
        postalCode: role !== 'ROLE_DOCTOR' ? location.postalCode.trim() || undefined : undefined,
        clinicCity: role === 'ROLE_DOCTOR' ? location.city.trim() : undefined,
        clinicPostalCode: role === 'ROLE_DOCTOR' ? location.postalCode.trim() || undefined : undefined,
        country: location.country || undefined,
        state: location.state || undefined,
        latitude: location.latitude,
        longitude: location.longitude,
        address: role === 'ROLE_CUSTOMER' ? address : role === 'ROLE_PROVIDER' ? businessAddress.trim() : undefined,
        businessName: role === 'ROLE_PROVIDER' ? businessName.trim() : undefined,
        description: role === 'ROLE_PROVIDER' ? businessAbout.trim() || undefined : undefined,
        categories: role === 'ROLE_PROVIDER' ? categories : undefined,
        emergencyContact: role === 'ROLE_CUSTOMER' ? emergencyContact : undefined,
        clinicName: role === 'ROLE_DOCTOR' ? clinicName.trim() || undefined : undefined,
        clinicAddress: role === 'ROLE_DOCTOR' ? clinicAddress.trim() || undefined : undefined,
        licenseNumber: role === 'ROLE_DOCTOR' ? licenseNumber.trim() || undefined : undefined,
        yearsOfExperience: role === 'ROLE_DOCTOR' ? parseInt(yearsOfExp, 10) || 1 : undefined,
        consultationFee: role === 'ROLE_DOCTOR' ? parseFloat(fee) || 50 : undefined,
        bio: role === 'ROLE_DOCTOR' ? bio : undefined,
      });
      // The account exists but is unverified: confirm the emailed code before signing in.
      navigation.navigate('VerifyOtp', { email: result.email });
    } catch (err: any) {
      const msg = getErrorMessage(err, 'Registration failed. Please verify details.');
      setError(msg);
      Alert.alert('Registration Failed', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Join VetConnect as a Pet Owner, Veterinarian or Pet Care business</Text>
        </View>

        {/* Role Toggle Switch */}
        <View style={styles.roleToggle}>
          <TouchableOpacity
            style={[styles.roleOption, role === 'ROLE_CUSTOMER' && styles.activeRole]}
            onPress={() => setRole('ROLE_CUSTOMER')}
            activeOpacity={0.8}
          >
            <Text style={[styles.roleText, role === 'ROLE_CUSTOMER' && styles.activeRoleText]}>
              Pet Owner
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.roleOption, role === 'ROLE_DOCTOR' && styles.activeRole]}
            onPress={() => setRole('ROLE_DOCTOR')}
            activeOpacity={0.8}
          >
            <Text style={[styles.roleText, role === 'ROLE_DOCTOR' && styles.activeRoleText]}>
              Veterinarian
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.roleOption, role === 'ROLE_PROVIDER' && styles.activeRole]}
            onPress={() => setRole('ROLE_PROVIDER')}
            activeOpacity={0.8}
            testID="role-provider"
          >
            <Text style={[styles.roleText, role === 'ROLE_PROVIDER' && styles.activeRoleText]}>
              Pet Care
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.form}>
          <AppInput
            label="Full Name *"
            placeholder={role === 'ROLE_CUSTOMER' ? 'e.g. John Doe' : role === 'ROLE_PROVIDER' ? 'Your name' : 'e.g. Dr. Sarah Jenkins'}
            value={fullName}
            onChangeText={setFullName}
            icon="person-outline"
          />

          <EmailField value={email} onChange={setEmail} forceError={submitted} testID="reg-email" />

          <AppInput
            label="Phone Number"
            placeholder="+1 555-0199"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            icon="call-outline"
          />

          <AppInput
            label="Password *"
            placeholder="At least 6 characters"
            value={password}
            onChangeText={setPassword}
            isPassword
            icon="lock-closed-outline"
            error={submitted ? passwordError(password) ?? undefined : undefined}
          />

          <AppInput
            label="Confirm Password *"
            placeholder="Re-enter your password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            isPassword
            icon="lock-closed-outline"
            error={(submitted || confirmPassword.length > 0) ? confirmPasswordError(password, confirmPassword) ?? undefined : undefined}
          />

          {role === 'ROLE_CUSTOMER' ? (
            <>
              <LocationPicker value={location} onChange={setLocation} errors={submitted ? locationErrors : undefined} />
              <AppInput
                label="Emergency Contact"
                placeholder="Phone number"
                value={emergencyContact}
                onChangeText={setEmergencyContact}
                keyboardType="phone-pad"
                icon="alert-circle-outline"
              />
            </>
          ) : role === 'ROLE_PROVIDER' ? (
            <>
              <AppInput
                label="Business Name *"
                placeholder="e.g. Happy Paws Grooming"
                value={businessName}
                onChangeText={setBusinessName}
                icon="storefront-outline"
              />
              <Text style={styles.fieldLabel}>What do you offer? *</Text>
              <View style={styles.chips}>
                {CATEGORIES.map((c) => {
                  const on = categories.includes(c.key);
                  return (
                    <TouchableOpacity
                      key={c.key}
                      style={[styles.chip, on && styles.chipOn]}
                      onPress={() => toggleCategory(c.key)}
                      activeOpacity={0.8}
                      testID={`reg-cat-${c.key}`}
                    >
                      <Text style={[styles.chipText, on && { color: '#FFFFFF' }]}>{c.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <AppInput
                label="About your business"
                placeholder="A short description for pet owners"
                value={businessAbout}
                onChangeText={setBusinessAbout}
                multiline
                numberOfLines={3}
                style={{ height: 75 }}
              />
              <AppInput
                label="Street Address *"
                placeholder="Street address"
                value={businessAddress}
                onChangeText={setBusinessAddress}
                icon="map-outline"
              />
              <LocationPicker value={location} onChange={setLocation} pinRequired districtLabel="District / City *" errors={submitted ? locationErrors : undefined} />
              <AppInput
                label="Registration / Licence Number"
                placeholder="Optional"
                value={licenseNumber}
                onChangeText={setLicenseNumber}
                icon="shield-checkmark-outline"
              />
            </>
          ) : (
            <>
              <AppInput
                label="Clinic Name *"
                placeholder="e.g. Springfield Animal Clinic"
                value={clinicName}
                onChangeText={setClinicName}
                icon="business-outline"
              />
              <AppInput
                label="Clinic Address *"
                placeholder="Street address, City"
                value={clinicAddress}
                onChangeText={setClinicAddress}
                icon="map-outline"
              />
              <LocationPicker value={location} onChange={setLocation} pinRequired districtLabel="Clinic District / City *" errors={submitted ? locationErrors : undefined} />
              <AppInput
                label="License / Registration Number"
                placeholder="e.g. VET-US-10294"
                value={licenseNumber}
                onChangeText={setLicenseNumber}
                icon="shield-checkmark-outline"
              />
              <View style={styles.rowInputs}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <AppInput
                    label="Years Exp"
                    placeholder="5"
                    value={yearsOfExp}
                    onChangeText={setYearsOfExp}
                    keyboardType="numeric"
                  />
                </View>
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <AppInput
                    label={`Consult Fee (${getCurrencySymbol()})`}
                    placeholder="60"
                    value={fee}
                    onChangeText={setFee}
                    keyboardType="numeric"
                  />
                </View>
              </View>
              <AppInput
                label="Professional Bio"
                placeholder="Brief summary of your veterinary background..."
                value={bio}
                onChangeText={setBio}
                multiline
                numberOfLines={3}
                style={{ height: 75 }}
              />
            </>
          )}

          {error && <Text style={styles.errorText}>{error}</Text>}

          <AppButton
            title="Create Account"
            onPress={handleRegister}
            loading={loading}
            style={styles.submitBtn}
          />

          <View style={styles.loginPrompt}>
            <Text style={styles.loginText}>Already registered? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text style={styles.loginLink}>Sign In</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    padding: 24,
    paddingTop: 40,
    flexGrow: 1,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.text,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },
  roleToggle: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  roleOption: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  activeRole: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  roleText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  activeRoleText: {
    color: colors.primary,
    fontWeight: '700',
  },
  form: {
    marginTop: 4,
  },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F1F5F9' },
  chipOn: { backgroundColor: colors.primary },
  chipText: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
  rowInputs: {
    flexDirection: 'row',
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    marginBottom: 12,
    textAlign: 'center',
  },
  submitBtn: {
    marginTop: 10,
    marginBottom: 20,
  },
  loginPrompt: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
  },
  loginText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  loginLink: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
});
