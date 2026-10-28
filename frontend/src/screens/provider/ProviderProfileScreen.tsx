import React, { useCallback, useState } from 'react';
import { View, Text } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { shared } from '../../theme/shared';
import { careApi, Provider, categoryLabel } from '../../api/careApi';
import { AppHeader } from '../../components/common/AppHeader';
import { KeyboardScroll } from '../../components/common/KeyboardScroll';
import { LoadingView } from '../../components/common/LoadingView';
import { ClinicLocationCard } from '../../components/common/ClinicLocationCard';
import { ProviderStatusCard } from '../../components/care/ProviderStatusCard';
import { ProviderForm, ProviderFormValues, toPayload } from '../../components/care/ProviderForm';
import { ProviderStackParamList } from '../../navigation/types';
import { getErrorMessage, notify } from '../../utils/helpers';

type Props = NativeStackScreenProps<ProviderStackParamList, 'ProviderProfile'>;

const toForm = (p: Provider): ProviderFormValues => ({
  businessName: p.businessName,
  description: p.description ?? '',
  phone: p.phone ?? '',
  registrationNumber: p.registrationNumber ?? '',
  address: p.address,
  categories: p.categories,
  location: {
    country: p.country ?? '', state: p.state ?? '', city: p.city, postalCode: p.postalCode ?? '',
    latitude: p.latitude ?? undefined, longitude: p.longitude ?? undefined,
  },
});

export const ProviderProfileScreen: React.FC<Props> = ({ navigation }) => {
  const [profile, setProfile] = useState<Provider | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(useCallback(() => {
    careApi.myProfile().then(setProfile).catch((e) => notify('Error', getErrorMessage(e)));
  }, []));

  if (!profile) return <LoadingView />;

  return (
    <View style={shared.screen}>
      <AppHeader
        title="Business profile"
        showBack
        onBack={() => navigation.goBack()}
        rightAction={{ icon: editing ? 'close' : 'create-outline', onPress: () => { setEditing((v) => !v); setError(null); } }}
      />
      <KeyboardScroll contentContainerStyle={shared.content} keyboardShouldPersistTaps="handled">
        <ProviderStatusCard profile={profile} onChanged={setProfile} />

        {editing ? (
          <View style={shared.card}>
            <ProviderForm
              initial={toForm(profile)}
              submitLabel="Save changes"
              saving={saving}
              error={error}
              onSubmit={async (values) => {
                setSaving(true);
                setError(null);
                try {
                  // keep the operating settings that are edited on the Hours & capacity screen
                  setProfile(await careApi.updateProfile({
                    ...toPayload(values),
                    advancePercent: profile.advancePercent,
                    concurrentCapacity: profile.concurrentCapacity,
                    boardingCapacity: profile.boardingCapacity,
                    slotMinutes: profile.slotMinutes,
                  }));
                  setEditing(false);
                } catch (e) {
                  setError(getErrorMessage(e, 'Could not save.'));
                } finally {
                  setSaving(false);
                }
              }}
            />
          </View>
        ) : (
          <>
            <View style={shared.card}>
              {[
                ['Business', profile.businessName],
                ['Offers', profile.categories.map(categoryLabel).join(', ')],
                ['About', profile.description],
                ['Phone', profile.phone],
                ['Registration number', profile.registrationNumber],
                ['Advance to book', `${profile.advancePercent}% of the price`],
              ].map(([k, v]) => (
                <View key={k} style={{ marginBottom: 10 }}>
                  <Text style={shared.label}>{k}</Text>
                  <Text style={shared.value}>{v || '-'}</Text>
                </View>
              ))}
            </View>
            <View style={shared.card}>
              <Text style={shared.sectionTitle}>Location</Text>
              <ClinicLocationCard
                clinicName={profile.businessName}
                address={profile.address}
                city={profile.city}
                state={profile.state}
                country={profile.country}
                latitude={profile.latitude}
                longitude={profile.longitude}
              />
            </View>
          </>
        )}
      </KeyboardScroll>
    </View>
  );
};
