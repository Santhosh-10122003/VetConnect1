import React, { useEffect, useState } from 'react';
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
  const [microchip, setMicrochip] = useState('');

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
        setMicrochip(p.microchipNumber ?? '');
      })
      .catch((e) => notify('Error', getErrorMessage(e)))
      .finally(() => setLoading(false));
  }, [petId]);

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Pet name is required';
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
      microchipNumber: microchip.trim() || undefined,
    };
    setSaving(true);
    try {
      if (petId) await petApi.updatePet(petId, payload);
      else await petApi.createPet(payload);
      navigation.goBack();
    } catch (e) {
      notify('Could not save pet', getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingView />;

  return (
    <View style={shared.screen}>
      <AppHeader title={petId ? 'Edit Pet' : 'Add Pet'} showBack onBack={() => navigation.goBack()} />
      <KeyboardScroll contentContainerStyle={shared.content} keyboardShouldPersistTaps="handled">
        <AppInput label="Name *" icon="paw-outline" value={name} onChangeText={setName} error={errors.name} placeholder="e.g. Bruno" />
        <Text style={shared.sectionTitle}>Species</Text>
        <Chips options={SPECIES} value={species} onChange={setSpecies} />
        <Text style={shared.sectionTitle}>Gender</Text>
        <Chips options={GENDERS} value={gender} onChange={setGender} />
        <AppInput label="Breed" value={breed} onChangeText={setBreed} placeholder="e.g. Labrador Retriever" />
        <DateField label="Date of birth" value={dob} onChange={setDob} maximumDate={new Date()} error={errors.dob} placeholder="Select date of birth" clearable testID="pet-dob" />
        <AppInput label="Weight (kg)" icon="scale-outline" value={weight} onChangeText={setWeight} error={errors.weight} keyboardType="decimal-pad" />
        <AppInput label="Allergies" value={allergies} onChangeText={setAllergies} placeholder="None known" />
        <AppInput label="Existing conditions" value={conditions} onChangeText={setConditions} placeholder="None" />
        <AppInput label="Microchip number" value={microchip} onChangeText={setMicrochip} autoCapitalize="characters" />
        <AppButton title={petId ? 'Save Changes' : 'Add Pet'} onPress={save} loading={saving} />
      </KeyboardScroll>
    </View>
  );
};
