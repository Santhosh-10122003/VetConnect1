import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors } from '../../theme/colors';
import { shared } from '../../theme/shared';
import { careApi } from '../../api/careApi';
import { doctorApi } from '../../api/doctorApi';
import { AppHeader } from '../../components/common/AppHeader';
import { KeyboardScroll } from '../../components/common/KeyboardScroll';
import { LoadingView } from '../../components/common/LoadingView';
import { ProviderForm, ProviderFormValues, emptyProviderForm, toPayload } from '../../components/care/ProviderForm';
import { ProviderStackParamList } from '../../navigation/types';
import { getErrorMessage } from '../../utils/helpers';

type Props = NativeStackScreenProps<ProviderStackParamList, 'ProviderSetup'>;

/** A vet doctor adds a pet-care business, starting from what the clinic profile already knows. */
export const ProviderSetupScreen: React.FC<Props> = ({ navigation }) => {
  const [initial, setInitial] = useState<ProviderFormValues | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    doctorApi.getMyDoctorProfile()
      .then((r) => {
        const d = r.data;
        setInitial({
          ...emptyProviderForm,
          businessName: d.clinicName ? `${d.clinicName} Pet Care` : '',
          phone: d.phone ?? '',
          address: d.clinicAddress ?? '',
          location: {
            country: d.clinicCountry ?? '', state: d.clinicState ?? '', city: d.clinicCity ?? '',
            postalCode: d.clinicPostalCode ?? '', latitude: d.latitude ?? undefined, longitude: d.longitude ?? undefined,
          },
        });
      })
      .catch(() => setInitial(emptyProviderForm));
  }, []);

  if (!initial) return <LoadingView />;

  return (
    <View style={shared.screen}>
      <AppHeader title="Set up pet care" showBack onBack={() => navigation.goBack()} />
      <KeyboardScroll contentContainerStyle={shared.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.intro}>
          Tell pet owners what you offer. We started from your clinic details. An admin reviews the business before it is listed.
        </Text>
        <ProviderForm
          initial={initial}
          submitLabel="Create pet-care profile"
          saving={saving}
          error={error}
          onSubmit={async (values) => {
            setSaving(true);
            setError(null);
            try {
              await careApi.createProfile(toPayload(values));
              navigation.reset({ index: 0, routes: [{ name: 'ProviderHome' }] });
            } catch (e) {
              setError(getErrorMessage(e, 'Could not create the profile.'));
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
  intro: { fontSize: 13, color: colors.textSecondary, lineHeight: 19, marginBottom: 16 },
});
