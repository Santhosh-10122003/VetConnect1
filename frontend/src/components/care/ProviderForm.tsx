import React, { useState } from 'react';
import { View, Text } from 'react-native';
import { shared } from '../../theme/shared';
import { colors } from '../../theme/colors';
import { AppInput } from '../common/AppInput';
import { AppButton } from '../common/AppButton';
import { LocationPicker, LocationValue, emptyLocation, LocationErrors } from '../common/LocationPicker';
import { TouchableOpacity } from 'react-native';
import { CATEGORIES, CareCategory, ProviderPayload } from '../../api/careApi';
import { PayoutFields, PayoutValues, emptyPayout, payoutErrors, payoutPayload } from './PayoutFields';

export interface ProviderFormValues {
  businessName: string;
  description: string;
  phone: string;
  registrationNumber: string;
  address: string;
  categories: CareCategory[];
  location: LocationValue;
  payout: PayoutValues;
}

export const emptyProviderForm: ProviderFormValues = {
  businessName: '', description: '', phone: '', registrationNumber: '', address: '', categories: [], location: emptyLocation, payout: emptyPayout,
};

/** The turn from the form's values into what the API wants. */
export const toPayload = (f: ProviderFormValues): ProviderPayload => ({
  businessName: f.businessName.trim(),
  description: f.description.trim() || undefined,
  phone: f.phone.trim() || undefined,
  registrationNumber: f.registrationNumber.trim() || undefined,
  address: f.address.trim(),
  city: f.location.city.trim(),
  state: f.location.state || undefined,
  country: f.location.country || undefined,
  postalCode: f.location.postalCode.trim() || undefined,
  latitude: f.location.latitude,
  longitude: f.location.longitude,
  categories: f.categories,
  ...payoutPayload(f.payout),
});

interface Props {
  initial: ProviderFormValues;
  submitLabel: string;
  saving: boolean;
  onSubmit: (values: ProviderFormValues) => void;
  /** Shown above the buttons, e.g. a server error. */
  error?: string | null;
  /** A clinic whose doctor profile already has payment details: they are reused, so the section is not shown. */
  reusePayout?: boolean;
}

/** Business details shared by the vet-clinic "offer pet care" setup and by editing the profile. */
export const ProviderForm: React.FC<Props> = ({ initial, submitLabel, saving, onSubmit, error, reusePayout }) => {
  const [f, setF] = useState<ProviderFormValues>(initial);
  const [tried, setTried] = useState(false);
  const set = <K extends keyof ProviderFormValues>(k: K, v: ProviderFormValues[K]) => setF((x) => ({ ...x, [k]: v }));

  const errors: Record<string, string> = {};
  if (!f.businessName.trim()) errors.businessName = 'Required';
  if (f.categories.length === 0) errors.categories = 'Choose at least one';
  if (!f.address.trim()) errors.address = 'Required';
  const loc: LocationErrors = {};
  if (!f.location.country) loc.country = 'Select a country';
  else if (!f.location.state) loc.state = 'Select a state';
  else if (!f.location.city.trim()) loc.city = 'Select a district';
  if (f.location.latitude == null) loc.pin = 'Pin your business on the map so pet owners can navigate to you.';

  const payErr = reusePayout ? {} : payoutErrors(f.payout);

  const submit = () => {
    setTried(true);
    if (Object.keys(errors).length || Object.keys(loc).length || Object.keys(payErr).length) return;
    onSubmit(f);
  };

  const toggle = (c: CareCategory) =>
    set('categories', f.categories.includes(c) ? f.categories.filter((x) => x !== c) : [...f.categories, c]);

  return (
    <View>
      <AppInput label="Business name *" value={f.businessName} onChangeText={(v) => set('businessName', v)} error={tried ? errors.businessName : undefined} icon="storefront-outline" />
      <Text style={shared.label}>What do you offer? *</Text>
      <View style={shared.chipRow}>
        {CATEGORIES.map((c) => (
          <TouchableOpacity key={c.key} testID={`cat-${c.key}`} style={[shared.chip, f.categories.includes(c.key) && shared.chipActive]} onPress={() => toggle(c.key)}>
            <Text style={[shared.chipText, f.categories.includes(c.key) && shared.chipTextActive]}>{c.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {tried && errors.categories ? <Text style={{ color: colors.danger, fontSize: 12, marginTop: -10, marginBottom: 12 }}>{errors.categories}</Text> : null}
      <AppInput label="About your business" value={f.description} onChangeText={(v) => set('description', v)} multiline style={{ height: 90, textAlignVertical: 'top', paddingTop: 12 }} />
      <AppInput label="Phone" value={f.phone} onChangeText={(v) => set('phone', v)} keyboardType="phone-pad" icon="call-outline" />
      <AppInput label="Registration / licence number" value={f.registrationNumber} onChangeText={(v) => set('registrationNumber', v)} icon="shield-checkmark-outline" />
      <AppInput label="Street address *" placeholder="Street, area" value={f.address} onChangeText={(v) => set('address', v)} error={tried ? errors.address : undefined} icon="map-outline" />
      <LocationPicker
        pinRequired
        districtLabel="District / City *"
        value={f.location}
        onChange={(l) => set('location', l)}
        errors={tried ? loc : undefined}
      />
      {reusePayout
        ? <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 14 }}>Payments go to the payment details saved on your doctor profile.</Text>
        : <PayoutFields value={f.payout} onChange={(v) => set('payout', v)} showErrors={tried} />}
      {error ? <Text style={{ color: colors.danger, marginBottom: 10 }}>{error}</Text> : null}
      <AppButton title={submitLabel} onPress={() => (reusePayout ? onSubmit({ ...f, payout: { ...f.payout, method: null } }) : submit())} loading={saving} />
    </View>
  );
};
