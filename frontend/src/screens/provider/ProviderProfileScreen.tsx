import { DocumentsCard } from '../../components/common/DocumentsCard';
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
import { payoutFromProvider } from '../../components/care/PayoutFields';
import { getErrorMessage, notify } from '../../utils/helpers';

type Props = NativeStackScreenProps<ProviderStackParamList, 'ProviderProfile'>;

const toForm = (p: Provider): ProviderFormValues => ({
  businessName: p.businessName,
  description: p.description ?? '',
  phone: p.phone ?? '',
  registrationNumber: p.registrationNumber ?? '',
  vetPartnerName: p.vetPartnerName ?? '',
  vetPartnerPhone: p.vetPartnerPhone ?? '+91 ',
  address: p.address,
  categories: p.categories,
  location: {
    country: p.country ?? '', state: p.state ?? '', city: p.city, postalCode: p.postalCode ?? '',
    latitude: p.latitude ?? undefined, longitude: p.longitude ?? undefined,
  },
  payout: payoutFromProvider(p),
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
        rightAction={profile.verificationStatus === 'PENDING' || profile.verificationStatus === 'RESUBMITTED' ? undefined : { icon: editing ? 'close' : 'create-outline', onPress: () => { setEditing((v) => !v); setError(null); } }}
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
                ['Trade licence number', profile.registrationNumber],
                ['Veterinarian you work with', [profile.vetPartnerName, profile.vetPartnerPhone].filter(Boolean).join(' · ')],
                ['Advance to book', `${profile.advancePercent}% of the price`],
                ['Payment details', profile.payoutComplete
                  ? (profile.payoutMethod === 'UPI' ? `UPI: ${profile.upiId}` : `Bank: ${profile.accountHolderName}, ${profile.bankAccountMasked}, ${profile.ifscCode}`)
                  : 'Not added yet: customers cannot book you until you add them'],
              ].map(([k, v]) => (
                <View key={k} style={{ marginBottom: 10 }}>
                  <Text style={shared.label}>{k}</Text>
                  <Text style={shared.value}>{v || '-'}</Text>
                </View>
              ))}
            </View>
            <DocumentsCard types={['TRADE_LICENCE', 'ID_PROOF', 'OTHER']} editable={profile.verificationStatus === 'REJECTED'} hint="Your trade licence from the municipal corporation. The admin checks it before approving your business." />
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
