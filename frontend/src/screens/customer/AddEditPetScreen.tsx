import React, { useEffect, useState } from 'react';
import { CopyIcon } from '../../components/common/CopyIcon';
import { formatPetId } from '../../api/petApi';
import { colors } from '../../theme/colors';
import type { PickedFile } from '../../api/documentApi';
import { pickPetPhoto } from '../../utils/petPhoto';
import { PetAvatar } from '../../components/pet/PetAvatar';
import { View, Text, TouchableOpacity } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { shared } from '../../theme/shared';
import { petApi, CreatePetPayload } from '../../api/petApi';
import { AppHeader } from '../../components/common/AppHeader';
import { KeyboardScroll } from '../../components/common/KeyboardScroll';
import { AppInput } from '../../components/common/AppInput';
import { AppButton } from '../../components/common/AppButton';
import { DateField } from '../../components/common/DateField';
import { LoadingView } from '../../components/common/LoadingView';
import { CustomerStackParamList } from '../../navigation/types';
import { getErrorMessage, notify } from '../../utils/helpers';
import { inputError } from '../../utils/inputRules';

type Props = NativeStackScreenProps<CustomerStackParamList, 'AddEditPet'>;

const SPECIES = ['DOG', 'CAT', 'BIRD', 'RABBIT', 'OTHER'];
const GENDERS = ['MALE', 'FEMALE', 'UNKNOWN'];

const Chips: React.FC<{ options: string[]; value: string; onChange: (v: string) => void }> = ({ options, value, onChange }) => (
  <View style={shared.chipRow}>
    {options.map((o) => (
      <TouchableOpacity key={o} style={[shared.chip, value === o && shared.chipActive]} onPress={() => onChange(o)}>
        <Text style={[shared.chipText, value === o && shared.chipTextActive]}>{o.charAt(0) + o.slice(1).toLowerCase()}</Text>
      </TouchableOpacity>
    ))}
  </View>
);

export const AddEditPetScreen: React.FC<Props> = ({ navigation, route }) => {
  const petId = route.params?.petId;
  const [loading, setLoading] = useState(!!petId);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [name, setName] = useState('');
  const [species, setSpecies] = useState('DOG');
  const [gender, setGender] = useState('UNKNOWN');
  const [breed, setBreed] = useState('');
  const [dob, setDob] = useState('');
  const [weight, setWeight] = useState('');
  const [allergies, setAllergies] = useState('');
  const [conditions, setConditions] = useState('');
  const [petIdNumber, setPetIdNumber] = useState('');
  const [avatar, setAvatar] = useState<string | undefined>(undefined);
  const [picked, setPicked] = useState<PickedFile | null>(null);
  const [removed, setRemoved] = useState(false);

  useEffect(() => {
    if (!petId) return;
    petApi
      .getPetById(petId)
      .then(({ data: p }) => {
        setName(p.name);
        setSpecies(p.species);
        setGender(p.gender ?? 'UNKNOWN');
        setBreed(p.breed ?? '');
        setDob(p.dateOfBirth ?? '');
        setWeight(p.weight != null ? String(p.weight) : '');
        setAllergies(p.allergies ?? '');
        setConditions(p.existingConditions ?? '');
        setPetIdNumber(p.microchipNumber ?? '');
        setAvatar(p.avatarUrl ?? undefined);
      })
      .catch((e) => notify('Error', getErrorMessage(e)))
      .finally(() => setLoading(false));
  }, [petId]);

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Pet name is required';
    else if (inputError('petName', name)) errs.name = inputError('petName', name) as string;
    if (dob && !/^\d{4}-\d{2}-\d{2}$/.test(dob)) errs.dob = 'Use YYYY-MM-DD';
    else if (dob && new Date(dob) > new Date()) errs.dob = 'Date of birth cannot be in the future';
    if (weight && (isNaN(Number(weight)) || Number(weight) <= 0)) errs.weight = 'Enter a valid weight in kg';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const save = async () => {
    if (!validate()) return;
    const payload: CreatePetPayload = {
      name: name.trim(),
      species,
      gender,
      breed: breed.trim() || undefined,
      dateOfBirth: dob || undefined,
      weight: weight ? Number(weight) : undefined,
      allergies: allergies.trim() || undefined,
      existingConditions: conditions.trim() || undefined,
    };
    setSaving(true);
    try {
      const saved = petId ? (await petApi.updatePet(petId, payload)).data : (await petApi.createPet(payload)).data;
      try {
        if (picked) await petApi.uploadPhoto(saved.id, picked);
        else if (removed && avatar) await petApi.removePhoto(saved.id);
      } catch (e) {
        notify('Pet saved, photo not uploaded', getErrorMessage(e));
      }
      navigation.goBack();
    } catch (e) {
      notify('Could not save pet', getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const choosePhoto = async () => {
    try {
      const f = await pickPetPhoto();
      if (f) { setPicked(f); setRemoved(false); }
    } catch (e) {
      notify('Could not open photos', getErrorMessage(e));
    }
  };

  if (loading) return <LoadingView />;

  return (
    <View style={shared.screen}>
      <AppHeader title={petId ? 'Edit Pet' : 'Add Pet'} showBack onBack={() => navigation.goBack()} />
      <KeyboardScroll contentContainerStyle={shared.content} keyboardShouldPersistTaps="handled">
        <View style={{ alignItems: 'center', marginBottom: 18 }}>
          <PetAvatar
            pet={{ name: name || '?', species, avatarUrl: removed ? undefined : avatar }}
            size={112}
            previewUri={picked?.uri}
            onEdit={choosePhoto}
            testID="pet-photo"
          />
          <TouchableOpacity onPress={choosePhoto} style={{ marginTop: 10 }} testID="pet-photo-choose">
            <Text style={{ color: colors.primaryLight, fontWeight: '800', fontSize: 14 }}>{picked || (avatar && !removed) ? 'Change photo' : 'Add a photo'}</Text>
          </TouchableOpacity>
          {(picked || (avatar && !removed)) && (
            <TouchableOpacity onPress={() => { setPicked(null); setRemoved(true); }} style={{ marginTop: 6 }} testID="pet-photo-remove">
              <Text style={{ color: colors.textMuted, fontWeight: '600', fontSize: 12 }}>Remove photo</Text>
            </TouchableOpacity>
          )}
        </View>
        <AppInput kind="petName" label="Name *" icon="paw-outline" value={name} onChangeText={setName} error={errors.name} placeholder="e.g. Bruno" />
        <Text style={shared.sectionTitle}>Species</Text>
        <Chips options={SPECIES} value={species} onChange={setSpecies} />
        <Text style={shared.sectionTitle}>Gender</Text>
        <Chips options={GENDERS} value={gender} onChange={setGender} />
        <AppInput kind="text" label="Breed" value={breed} onChangeText={setBreed} placeholder="e.g. Labrador Retriever" />
        <DateField label="Date of birth" value={dob} onChange={setDob} maximumDate={new Date()} error={errors.dob} placeholder="Select date of birth" clearable testID="pet-dob" />
        <AppInput kind="decimal" label="Weight (kg)" icon="scale-outline" value={weight} onChangeText={setWeight} error={errors.weight} keyboardType="decimal-pad" />
        <AppInput kind="text" label="Allergies" value={allergies} onChangeText={setAllergies} placeholder="None known" />
        <AppInput kind="text" label="Existing conditions" value={conditions} onChangeText={setConditions} placeholder="None" />
        <View style={{ backgroundColor: colors.mint, borderRadius: 16, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: colors.mintDark }} testID="pet-id-note">
          <Text style={{ fontSize: 13, fontWeight: '800', color: colors.ink }}>Pet QR code</Text>
          <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 4, lineHeight: 17 }}>
            {petIdNumber ? 'Your pet\'s QR code is on their page. Open it to show or print it.' : 'We make a QR code for your pet when you save. If your pet is ever lost, whoever scans it can reach you.'}
          </Text>
        </View>
        <AppButton title={petId ? 'Save Changes' : 'Add Pet'} onPress={save} loading={saving} />
      </KeyboardScroll>
    </View>
  );
};
