import React, { useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Animated, Easing, Alert } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { AppButton } from '../../components/common/AppButton';
import { AppInput } from '../../components/common/AppInput';
import { PhoneField } from '../../components/common/PhoneField';
import { SelectField } from '../../components/common/SelectField';
import { VET_COUNCILS } from '../../data/vetCouncils';
import { KeyboardAvoid } from '../../components/common/KeyboardScroll';
import { DocumentsPicker } from '../../components/common/DocumentsPicker';
import { inputError } from '../../utils/inputRules';
import { LocationPicker, LocationValue, LocationErrors, emptyLocation } from '../../components/common/LocationPicker';
import { phoneError, passwordError, confirmPasswordError, normalizePhone } from '../../utils/validators';
import { useAuth } from '../../context/AuthContext';
import { getCurrencySymbol, getErrorMessage } from '../../utils/helpers';
import { queueDocuments, QueuedDocument } from '../../utils/pendingDocuments';
import { CATEGORIES, CareCategory } from '../../api/careApi';
import { PayoutFields, PayoutValues, emptyPayout, payoutErrors, payoutPayload } from '../../components/care/PayoutFields';
import { AuthStackParamList } from '../../navigation/types';
import { themedStyles } from '../../theme/themed';
import { useTopPad } from '../../utils/useTopPad';

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;
type Role = 'ROLE_CUSTOMER' | 'ROLE_DOCTOR' | 'ROLE_PROVIDER';

const ROLES: { key: Role; testID: string; title: string; text: string; need?: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'ROLE_CUSTOMER', testID: 'role-customer', title: 'Pet Owner', text: 'Book vets, grooming and boarding, and keep your pet\'s records.', icon: 'paw' },
  { key: 'ROLE_DOCTOR', testID: 'role-doctor', title: 'Veterinarian', text: 'List your clinic, take appointments and get paid for the advance.', need: 'Have ready: degree, registration number, council certificate, UPI or bank details.', icon: 'medkit' },
  { key: 'ROLE_PROVIDER', testID: 'role-provider', title: 'Pet Care', text: 'Offer grooming, boarding or training and take bookings online.', need: 'Have ready: trade licence, your partner vet\'s name and mobile, UPI or bank details.', icon: 'storefront' },
];

/** The pages of the form for each kind of person; the first two are the same for everyone. */
const STEPS: Record<Role, { title: string; sub: string }[]> = {
  ROLE_CUSTOMER: [
    { title: 'Who are you?', sub: 'Choose how you will use Jenni' },
    { title: 'Your account', sub: 'Your mobile number is your login' },
    { title: 'Where you live', sub: 'So we can show you vets near you' },
  ],
  ROLE_DOCTOR: [
    { title: 'Who are you?', sub: 'Choose how you will use Jenni' },
    { title: 'Your account', sub: 'Your mobile number is your login' },
    { title: 'Your clinic', sub: 'Where pet owners will find you' },
    { title: 'Your credentials', sub: 'The admin checks these before approving you' },
    { title: 'Get paid', sub: 'Where your advance payments go' },
  ],
  ROLE_PROVIDER: [
    { title: 'Who are you?', sub: 'Choose how you will use Jenni' },
    { title: 'Your account', sub: 'Your mobile number is your login' },
    { title: 'Your business', sub: 'What you offer and where' },
    { title: 'Licence and vet', sub: 'The admin checks these before approving you' },
    { title: 'Get paid', sub: 'Where your advance payments go' },
  ],
};

export const RegisterScreen: React.FC<Props> = ({ navigation, route }) => {
  const topPad = useTopPad(44);
  const { register } = useAuth();
  const [role, setRole] = useState<Role>(route.params?.defaultRole || 'ROLE_CUSTOMER');
  const [step, setStep] = useState(route.params?.defaultRole ? 1 : 0);
  const [tried, setTried] = useState(false);

  // Common fields
  const [fullName, setFullName] = useState('');
  const [mobile, setMobile] = useState('+91 ');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Customer fields
  const [location, setLocation] = useState<LocationValue>(emptyLocation);
  const [address, setAddress] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');

  // Doctor fields
  const [clinicName, setClinicName] = useState('');
  const [clinicAddress, setClinicAddress] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [degree, setDegree] = useState('');
  const [councilName, setCouncilName] = useState('');
  const [yearsOfExp, setYearsOfExp] = useState('5');
  const [fee, setFee] = useState('60');
  const [bio, setBio] = useState('');

  // Pet-care business fields
  const [businessName, setBusinessName] = useState('');
  const [businessAbout, setBusinessAbout] = useState('');
  const [businessAddress, setBusinessAddress] = useState('');
  const [categories, setCategories] = useState<CareCategory[]>([]);
  const [vetName, setVetName] = useState('');
  const [vetPhone, setVetPhone] = useState('+91 ');

  // Doctors and businesses
  const [payout, setPayout] = useState<PayoutValues>(emptyPayout);
  const [documents, setDocuments] = useState<QueuedDocument[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleCategory = (c: CareCategory) =>
    setCategories((cur) => (cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]));

  const steps = STEPS[role];
  const last = step === steps.length - 1;

  const locationErrors: LocationErrors = {};
  if (!location.country) locationErrors.country = 'Select a country';
  else if (!location.state) locationErrors.state = 'Select a state';
  else if (!location.city.trim()) locationErrors.city = 'Select a district';
  if (role !== 'ROLE_CUSTOMER' && location.latitude == null) locationErrors.pin = role === 'ROLE_DOCTOR'
    ? 'Pin your clinic on the map so pet owners can navigate to you.'
    : 'Pin your place on the map so pet owners can navigate to you.';
  else if (role !== 'ROLE_CUSTOMER' && !location.pinConfirmed) locationErrors.pin = 'Check the pin on the map and tick the box to confirm it is your exact location.';

  // ---- a gentle slide-in whenever the page changes
  const enter = useRef(new Animated.Value(1)).current;
  const bar = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    enter.setValue(0);
    Animated.parallel([
      Animated.timing(enter, { toValue: 1, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
      Animated.timing(bar, { toValue: (step + 1) / steps.length, duration: 380, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
    ]).start();
  }, [step, steps.length, enter, bar]);

  /** What is wrong with the page being shown, if anything. */
  const problem = (): string | null => {
    if (step === 1) {
      if (!fullName.trim()) return 'Please enter your full name.';
      const nameBad = inputError('name', fullName); if (nameBad) return `Full name: ${nameBad}.`;
      if (phoneError(mobile) || passwordError(password) || confirmPasswordError(password, confirmPassword)) return 'Please fix the highlighted fields.';
    }
    if (role === 'ROLE_CUSTOMER' && step === 2 && Object.keys(locationErrors).length) {
      return 'Please choose your country, state and district so we can show you veterinarians near you.';
    }
    if (role === 'ROLE_DOCTOR') {
      if (step === 2) {
        if (!clinicName.trim()) return 'Please enter your clinic name.';
        if (!clinicAddress.trim()) return 'Please enter your clinic address.';
        const clinicBad = inputError('business', clinicName) || inputError('address', clinicAddress); if (clinicBad) return `Clinic details: ${clinicBad}.`;
        if (Object.keys(locationErrors).length) return 'Please choose your clinic location and pin it on the map so pet owners can find and navigate to you.';
      }
      if (step === 3 && (!degree.trim() || !licenseNumber.trim() || !councilName.trim())) {
        return 'Please enter your degree, veterinary registration number and the State Veterinary Council you are registered with.';
      }
      if (step === 3) {
        const credBad = inputError('degree', degree) || inputError('regNo', licenseNumber); if (credBad) return `Credentials: ${credBad}.`;
      }
    }
    if (role === 'ROLE_PROVIDER') {
      if (step === 2) {
        if (!businessName.trim()) return 'Please enter your business name.';
        if (categories.length === 0) return 'Choose at least one service: grooming, boarding or training.';
        if (!businessAddress.trim()) return 'Please enter your street address.';
        const bizBad = inputError('business', businessName) || inputError('address', businessAddress); if (bizBad) return `Business details: ${bizBad}.`;
        if (Object.keys(locationErrors).length) return 'Please choose your business location and pin it on the map so pet owners can find and navigate to you.';
      }
      if (step === 3) {
        if (!licenseNumber.trim()) return 'Please enter your trade licence number.';
        if (!vetName.trim() || phoneError(vetPhone)) return 'Please give the name and mobile number of the veterinarian you work with.';
        const licBad = inputError('regNo', licenseNumber) || inputError('name', vetName); if (licBad) return `Details: ${licBad}.`;
      }
    }
    if (role !== 'ROLE_CUSTOMER' && step === 4 && Object.keys(payoutErrors(payout)).length) {
      return 'Please add your payment details (UPI id or bank account) so you can receive payments.';
    }
    return null;
  };

  const go = (to: number) => { setStep(to); setTried(false); setError(null); };

  const next = () => {
    setTried(true);
    const p = problem();
    if (p) return setError(p);
    setError(null);
    if (last) return handleRegister();
    go(step + 1);
  };

  const back = () => {
    if (step === 0) navigation.goBack();
    else go(step - 1);
  };

  const chooseRole = (r: Role) => {
    if (r !== role) {
      // a different kind of account is a fresh form: nothing typed for the other one carries over
      setFullName(''); setMobile('+91 '); setPassword(''); setConfirmPassword('');
      setLocation(emptyLocation); setAddress(''); setEmergencyContact('');
      setClinicName(''); setClinicAddress(''); setLicenseNumber(''); setDegree(''); setCouncilName('');
      setYearsOfExp('5'); setFee('60'); setBio('');
      setBusinessName(''); setBusinessAbout(''); setBusinessAddress(''); setCategories([]); setVetName(''); setVetPhone('+91 ');
      setPayout(emptyPayout); setDocuments([]);
      setTried(false); setError(null);
    }
    setRole(r);
  };

  const handleRegister = async () => {
    setError(null);
    setLoading(true);
    try {
      const result = await register({
        role,
        fullName: fullName.trim(),
        password,
        confirmPassword,
        phone: normalizePhone(mobile),
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
        ...(role !== 'ROLE_CUSTOMER' ? payoutPayload(payout) : {}),
        emergencyContact: role === 'ROLE_CUSTOMER' ? emergencyContact : undefined,
        clinicName: role === 'ROLE_DOCTOR' ? clinicName.trim() || undefined : undefined,
        clinicAddress: role === 'ROLE_DOCTOR' ? clinicAddress.trim() || undefined : undefined,
        licenseNumber: role !== 'ROLE_CUSTOMER' ? licenseNumber.trim() || undefined : undefined,
        degree: role === 'ROLE_DOCTOR' ? degree.trim() : undefined,
        councilName: role === 'ROLE_DOCTOR' ? councilName.trim() : undefined,
        vetPartnerName: role === 'ROLE_PROVIDER' ? vetName.trim() : undefined,
        vetPartnerPhone: role === 'ROLE_PROVIDER' ? normalizePhone(vetPhone) : undefined,
        yearsOfExperience: role === 'ROLE_DOCTOR' ? parseInt(yearsOfExp, 10) || 1 : undefined,
        consultationFee: role === 'ROLE_DOCTOR' ? parseFloat(fee) || 50 : undefined,
        bio: role === 'ROLE_DOCTOR' ? bio : undefined,
      });
      // the files wait until the mobile number is verified, then go up with the new account
      queueDocuments(role === 'ROLE_CUSTOMER' ? [] : documents);
      navigation.navigate('VerifyOtp', { mobile: result.mobile });
    } catch (err: any) {
      const msg = getErrorMessage(err, 'Registration failed. Please verify details.');
      setError(msg);
      Alert.alert('Registration Failed', msg);
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------------------------------------- the pages

  const pageRole = (
    <View>
      {ROLES.map((r) => {
        const on = role === r.key;
        return (
          <TouchableOpacity key={r.key} style={[styles.roleCard, on && styles.roleCardOn]} onPress={() => chooseRole(r.key)} activeOpacity={0.85} testID={r.testID}>
            <View style={[styles.roleIcon, on && styles.roleIconOn]}>
              <Ionicons name={r.icon} size={26} color={on ? '#FFFFFF' : colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.roleTitle}>{r.title}</Text>
              <Text style={styles.roleText}>{r.text}</Text>
              {!!r.need && <Text style={styles.roleNeed}>{r.need}</Text>}
            </View>
            <Ionicons name={on ? 'checkmark-circle' : 'ellipse-outline'} size={24} color={on ? colors.primary : colors.mintDark} />
          </TouchableOpacity>
        );
      })}
      <View style={styles.loginPrompt}>
        <Text style={styles.loginText}>Already registered? </Text>
        <TouchableOpacity onPress={() => navigation.navigate('Login')}>
          <Text style={styles.loginLink}>Sign In</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const pageAccount = (
    <View>
      <AppInput kind="name"
        label="Full Name *"
        placeholder={role === 'ROLE_CUSTOMER' ? 'e.g. John Doe' : role === 'ROLE_PROVIDER' ? 'Your name' : 'e.g. Dr. Sarah Jenkins'}
        value={fullName}
        onChangeText={setFullName}
        icon="person-outline"
        error={tried && !fullName.trim() ? 'Required' : undefined}
      />
      <PhoneField value={mobile} onChange={setMobile} forceError={tried} fixedCode="+91" testID="reg-mobile" />
      <AppInput
        label="Password *"
        placeholder="At least 6 characters"
        value={password}
        onChangeText={setPassword}
        isPassword
        icon="lock-closed-outline"
        error={tried ? passwordError(password) ?? undefined : undefined}
      />
      <AppInput
        label="Confirm Password *"
        placeholder="Re-enter your password"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        isPassword
        icon="lock-closed-outline"
        error={(tried || confirmPassword.length > 0) ? confirmPasswordError(password, confirmPassword) ?? undefined : undefined}
      />
    </View>
  );

  const pageCustomer = (
    <View>
      <LocationPicker defaultCountry="India" hideCountry value={location} onChange={setLocation} errors={tried ? locationErrors : undefined} />
      <PhoneField label="Emergency Contact" value={emergencyContact} onChange={setEmergencyContact} optional />
    </View>
  );

  const pageClinic = (
    <View>
      <AppInput kind="business" label="Clinic Name *" placeholder="e.g. Springfield Animal Clinic" value={clinicName} onChangeText={setClinicName} icon="business-outline" />
      <AppInput kind="address" label="Clinic Address *" placeholder="Street address, City" value={clinicAddress} onChangeText={setClinicAddress} icon="map-outline" />
      <LocationPicker defaultCountry="India" hideCountry value={location} onChange={setLocation} pinRequired districtLabel="Clinic District / City *" errors={tried ? locationErrors : undefined} />
      <View style={styles.rowInputs}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <AppInput kind="integer" label="Years Exp" placeholder="5" value={yearsOfExp} onChangeText={setYearsOfExp} keyboardType="numeric" />
        </View>
        <View style={{ flex: 1, marginLeft: 8 }}>
          <AppInput kind="decimal" label={`Consult Fee (${getCurrencySymbol()})`} placeholder="60" value={fee} onChangeText={setFee} keyboardType="numeric" />
        </View>
      </View>
      <AppInput kind="note" label="Professional Bio" placeholder="Brief summary of your veterinary background..." value={bio} onChangeText={setBio} multiline numberOfLines={3} style={{ height: 75 }} />
    </View>
  );

  const pageCredentials = (
    <View>
      <AppInput kind="degree" label="Degree *" placeholder="e.g. B.V.Sc. & A.H." value={degree} onChangeText={setDegree} icon="school-outline" testID="reg-degree" error={tried && !degree.trim() ? 'Required' : undefined} />
      <AppInput kind="regNo" label="Veterinary Registration Number *" placeholder="e.g. TNSVC-12345" value={licenseNumber} onChangeText={setLicenseNumber} icon="shield-checkmark-outline" testID="reg-license" error={tried && !licenseNumber.trim() ? 'Required' : undefined} />
      <SelectField
        testID="reg-council"
        label="State Veterinary Council *"
        placeholder="Select your council"
        icon="ribbon-outline"
        value={councilName}
        options={VET_COUNCILS}
        onSelect={(o) => setCouncilName(o.value)}
        searchPlaceholder="Search council"
        error={tried && !councilName.trim() ? 'Required' : undefined}
      />
      <DocumentsPicker
        types={['DEGREE', 'REGISTRATION_CERTIFICATE', 'ID_PROOF', 'OTHER']}
        value={documents}
        onChange={setDocuments}
        hint="Your degree and State Veterinary Council registration certificate. The admin checks them against the council register."
      />
    </View>
  );

  const pageBusiness = (
    <View>
      <AppInput kind="business" label="Business Name *" placeholder="e.g. Happy Paws Grooming" value={businessName} onChangeText={setBusinessName} icon="storefront-outline" />
      <Text style={styles.fieldLabel}>What do you offer? *</Text>
      <View style={styles.chips}>
        {CATEGORIES.map((c) => {
          const on = categories.includes(c.key);
          return (
            <TouchableOpacity key={c.key} style={[styles.chip, on && styles.chipOn]} onPress={() => toggleCategory(c.key)} activeOpacity={0.8} testID={`reg-cat-${c.key}`}>
              <Text style={[styles.chipText, on && { color: '#FFFFFF' }]}>{c.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <AppInput kind="note" label="About your business" placeholder="A short description for pet owners" value={businessAbout} onChangeText={setBusinessAbout} multiline numberOfLines={3} style={{ height: 75 }} />
      <AppInput kind="address" label="Street Address *" placeholder="Street address" value={businessAddress} onChangeText={setBusinessAddress} icon="map-outline" />
      <LocationPicker defaultCountry="India" hideCountry value={location} onChange={setLocation} pinRequired districtLabel="District / City *" errors={tried ? locationErrors : undefined} />
    </View>
  );

  const pageLicence = (
    <View>
      <AppInput kind="regNo" label="Trade Licence Number *" placeholder="From your municipal corporation" value={licenseNumber} onChangeText={setLicenseNumber} icon="shield-checkmark-outline" testID="reg-trade-licence" error={tried && !licenseNumber.trim() ? 'Required' : undefined} />
      <AppInput kind="name" label="Veterinarian you work with *" placeholder="On-call or partner vet, e.g. Dr. Asha" value={vetName} onChangeText={setVetName} icon="medkit-outline" autoCapitalize="words" testID="reg-vet-name" error={tried && !vetName.trim() ? 'Required' : undefined} />
      <PhoneField label="Veterinarian's mobile number *" value={vetPhone} onChange={setVetPhone} forceError={tried} fixedCode="+91" testID="reg-vet-phone" />
      <DocumentsPicker
        types={['TRADE_LICENCE', 'ID_PROOF', 'OTHER']}
        value={documents}
        onChange={setDocuments}
        hint="Your trade licence from the municipal corporation. The admin checks it before approving your business."
      />
    </View>
  );

  const pagePay = <PayoutFields value={payout} onChange={setPayout} showErrors={tried} />;

  const page =
    step === 0 ? pageRole
    : step === 1 ? pageAccount
    : role === 'ROLE_CUSTOMER' ? pageCustomer
    : step === 2 ? (role === 'ROLE_DOCTOR' ? pageClinic : pageBusiness)
    : step === 3 ? (role === 'ROLE_DOCTOR' ? pageCredentials : pageLicence)
    : pagePay;

  return (
    <KeyboardAvoid style={styles.container}>
      <View style={[styles.top, { paddingTop: topPad }]}>
        <View style={styles.topRow}>
          <TouchableOpacity style={styles.backBtn} onPress={back} accessibilityLabel="Back" testID="reg-back">
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.stepCount} testID="reg-step">Step {step + 1} of {steps.length}</Text>
        </View>
        <View style={styles.track}>
          <Animated.View style={[styles.fill, { width: bar.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]} />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        <Animated.View style={{ opacity: enter, transform: [{ translateX: enter.interpolate({ inputRange: [0, 1], outputRange: [28, 0] }) }] }}>
          <Text style={styles.title}>{steps[step].title}</Text>
          <Text style={styles.subtitle}>{steps[step].sub}</Text>
          <View style={styles.page}>{page}</View>
        </Animated.View>
      </ScrollView>

      <View style={styles.footer}>
        {error && <Text style={styles.errorText}>{error}</Text>}
        <View style={styles.footerRow}>
          {step > 0 && (
            <AppButton title="Back" variant="outline" onPress={back} style={styles.footerBack} />
          )}
          <AppButton
            title={last ? 'Create Account' : 'Next'}
            onPress={next}
            loading={loading}
            style={styles.footerNext}
            testID="reg-next"
          />
        </View>
      </View>
    </KeyboardAvoid>
  );
};

const styles = themedStyles(() => ({
  container: { flex: 1, backgroundColor: colors.canvas },
  top: { paddingHorizontal: 20, paddingTop: 44, paddingBottom: 6 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
  stepCount: { fontSize: 13, fontWeight: '800', color: colors.textSecondary },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.mint, marginTop: 14, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3, backgroundColor: colors.primary },
  scrollContent: { padding: 24, paddingTop: 18, flexGrow: 1 },
  title: { fontSize: 28, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  subtitle: { fontSize: 14, color: colors.textSecondary, marginTop: 4 },
  page: { marginTop: 22 },
  roleCard: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 22, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.card, marginBottom: 12 },
  roleCardOn: { borderColor: colors.primary, backgroundColor: colors.mint },
  roleIcon: { width: 52, height: 52, borderRadius: 18, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
  roleIconOn: { backgroundColor: colors.primary },
  roleTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
  roleNeed: { fontSize: 11, color: colors.primaryLight, fontWeight: '700', marginTop: 5, lineHeight: 15 },
  roleText: { fontSize: 12, color: colors.textSecondary, marginTop: 3, lineHeight: 17 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: colors.subtle },
  chipOn: { backgroundColor: colors.primary },
  chipText: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
  rowInputs: { flexDirection: 'row' },
  footer: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 20, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.card },
  footerRow: { flexDirection: 'row', gap: 10 },
  footerBack: { flex: 1, marginTop: 0 },
  footerNext: { flex: 2, marginTop: 0 },
  errorText: { color: colors.danger, fontSize: 13, marginBottom: 8, textAlign: 'center' },
  loginPrompt: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 14, marginBottom: 10 },
  loginText: { fontSize: 14, color: colors.textSecondary },
  loginLink: { fontSize: 14, fontWeight: '700', color: colors.ink },
}));
