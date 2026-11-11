import React, { useCallback, useState } from 'react';
import { PetQr } from '../../components/pet/PetQr';
import { CopyIcon } from '../../components/common/CopyIcon';
import { formatPetId } from '../../api/petApi';
import { pickPetPhoto } from '../../utils/petPhoto';
import { PetAvatar } from '../../components/pet/PetAvatar';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { shared } from '../../theme/shared';
import { petApi, Pet } from '../../api/petApi';
import { medicalApi, MedicalRecord } from '../../api/medicalApi';
import { AppHeader } from '../../components/common/AppHeader';
import { AppButton } from '../../components/common/AppButton';
import { EmptyState } from '../../components/common/EmptyState';
import { LoadingView } from '../../components/common/LoadingView';
import { CustomerStackParamList } from '../../navigation/types';
import { confirmAction, getErrorMessage, notify, petAge, drName } from '../../utils/helpers';
import { themedStyles } from '../../theme/themed';

type Props = NativeStackScreenProps<CustomerStackParamList, 'PetDetails'>;
type Tab = 'OVERVIEW' | 'HISTORY' | 'VACCINES';

const Field: React.FC<{ label: string; value?: string | number | null }> = ({ label, value }) => (
  <View style={{ marginBottom: 10 }}>
    <Text style={shared.label}>{label}</Text>
    <Text style={shared.value}>{value || '-'}</Text>
  </View>
);

export const PetDetailsScreen: React.FC<Props> = ({ navigation, route }) => {
  const { petId } = route.params;
  const [pet, setPet] = useState<Pet | null>(null);
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [tab, setTab] = useState<Tab>('OVERVIEW');
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    try {
      const [p, r] = await Promise.all([petApi.getPetById(petId), medicalApi.getPetMedicalRecords(petId)]);
      setPet(p.data);
      setRecords(r.data);
    } catch (e) {
      notify('Error', getErrorMessage(e));
    }
  }, [petId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!pet) return <LoadingView />;

  // Vaccination entries are prescriptions whose medication or the visit plan mentions a vaccine.
  const vaccines = records.flatMap((r) =>
    r.prescriptions
      .filter((p) => /vaccin|rabies|dhpp|booster/i.test(p.medicationName))
      .map((p) => ({ ...p, visitDate: r.visitDate, doctorName: r.doctorName }))
  );

  const remove = async () => {
    if (!(await confirmAction('Remove pet', `Remove ${pet.name} and their records from your account?`, 'Remove', true))) return;
    try {
      await petApi.deletePet(pet.id);
      navigation.goBack();
    } catch (e) {
      notify('Could not remove pet', getErrorMessage(e));
    }
  };

  const changePhoto = async () => {
    try {
      const f = await pickPetPhoto();
      if (!f) return;
      setUploading(true);
      setPet(await petApi.uploadPhoto(pet.id, f));
    } catch (e) {
      notify('Could not change the photo', getErrorMessage(e));
    } finally {
      setUploading(false);
    }
  };

  const gender = pet.gender === 'MALE' ? 'Boy' : pet.gender === 'FEMALE' ? 'Girl' : 'Not set';
  const TABS: [Tab, string][] = [['OVERVIEW', 'Overview'], ['HISTORY', 'Medical History'], ['VACCINES', 'Vaccinations']];

  return (
    <View style={shared.screen}>
      <AppHeader
        title={pet.name}
        subtitle={`${pet.species}${pet.breed ? ' · ' + pet.breed : ''}`}
        showBack
        onBack={() => navigation.goBack()}
        rightAction={{ icon: 'create-outline', onPress: () => navigation.navigate('AddEditPet', { petId: pet.id }) }}
      />
      <View style={shared.segment}>
        {TABS.map(([key, label]) => (
          <TouchableOpacity key={key} style={[shared.segmentItem, tab === key && shared.segmentItemActive]} onPress={() => setTab(key)}>
            <Text style={[shared.segmentText, tab === key && shared.segmentTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={shared.content}>
        <View style={styles.hero} testID="pet-hero">
          <PetAvatar pet={pet} size={104} onEdit={uploading ? undefined : changePhoto} />
          <Text style={styles.heroName}>{pet.name}</Text>
          <Text style={styles.heroSub}>{pet.breed || (pet.species.charAt(0) + pet.species.slice(1).toLowerCase())}</Text>
          <View style={styles.stats}>
            <View style={styles.stat}><Text style={styles.statValue}>{pet.dateOfBirth ? petAge(pet.dateOfBirth) : '-'}</Text><Text style={styles.statLabel}>Age</Text></View>
            <View style={styles.stat}><Text style={styles.statValue}>{pet.weight != null ? `${pet.weight} kg` : '-'}</Text><Text style={styles.statLabel}>Weight</Text></View>
            <View style={styles.stat}><Text style={styles.statValue}>{gender}</Text><Text style={styles.statLabel}>Sex</Text></View>
          </View>
          {uploading && <Text style={styles.uploading}>Saving photo...</Text>}
        </View>

        {tab === 'OVERVIEW' && (
          <>
            <View style={shared.card}>
              <Field label="Date of birth" value={pet.dateOfBirth} />
              <Field label="Allergies" value={pet.allergies || "None known"} />
              <Field label="Existing conditions" value={pet.existingConditions || "None"} />
            </View>

            {!!pet.microchipNumber && (
              <View style={[shared.card, { alignItems: 'center', paddingVertical: 20 }]} testID="pet-qr-card">
                <Text style={shared.sectionTitle}>{pet.name}'s QR code</Text>
                <Text style={{ fontSize: 12, color: colors.textSecondary, textAlign: 'center', marginBottom: 14, lineHeight: 17, paddingHorizontal: 12 }}>
                  If {pet.name} is ever lost, whoever finds them can scan this with their phone. It opens Jenni and shows how to reach you. Put it on their collar tag.
                </Text>
                <PetQr number={pet.microchipNumber} name={pet.name} />
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 }}>
                  <Text style={{ fontSize: 12, color: colors.textMuted }} testID="pet-id-number">ID {formatPetId(pet.microchipNumber)}</Text>
                  <CopyIcon value={pet.microchipNumber} label="Copy" testID="copy-pet-id" />
                </View>
              </View>
            )}
            <AppButton title="Remove Pet" variant="outline" textStyle={{ color: colors.danger }} style={{ borderColor: colors.danger }} onPress={remove} />
          </>
        )}

        {tab === 'HISTORY' &&
          (records.length === 0 ? (
            <EmptyState icon="document-text-outline" title="No medical history" message="Records added by your vet after each visit will appear here." />
          ) : (
            records.map((r) => (
              <View key={r.id} style={shared.card}>
                <View style={shared.rowBetween}>
                  <Text style={styles.date}>{r.visitDate}</Text>
                  <Text style={styles.doc}>{drName(r.doctorName)}</Text>
                </View>
                <Text style={styles.diagnosis}>{r.diagnosis}</Text>
                {r.symptoms ? <Field label="Symptoms" value={r.symptoms} /> : null}
                {r.treatmentPlan ? <Field label="Treatment" value={r.treatmentPlan} /> : null}
                {r.weightAtVisit != null ? <Field label="Weight at visit" value={`${r.weightAtVisit} kg`} /> : null}
                {r.prescriptions.map((p) => (
                  <View key={p.id} style={styles.rx}>
                    <Ionicons name="medical-outline" size={16} color={colors.primary} />
                    <Text style={styles.rxText}>
                      {p.medicationName} — {p.dosage}, {p.frequency}, {p.durationDays} days
                    </Text>
                  </View>
                ))}
              </View>
            ))
          ))}

        {tab === 'VACCINES' &&
          (vaccines.length === 0 ? (
            <EmptyState icon="shield-checkmark-outline" title="No vaccination records" message="Vaccines recorded by your vet will be listed here." />
          ) : (
            vaccines.map((v) => (
              <View key={`${v.id}`} style={shared.card}>
                <View style={shared.row}>
                  <Ionicons name="shield-checkmark" size={20} color={colors.success} />
                  <Text style={[styles.diagnosis, { marginLeft: 8, marginVertical: 0 }]}>{v.medicationName}</Text>
                </View>
                <Text style={styles.doc}>
                  {v.visitDate} · {drName(v.doctorName)}
                </Text>
                {v.instructions ? <Text style={styles.rxText}>{v.instructions}</Text> : null}
              </View>
            ))
          ))}
      </ScrollView>
    </View>
  );
};

const styles = themedStyles(() => ({
  hero: { alignItems: 'center', backgroundColor: colors.card, borderRadius: 26, borderWidth: 1, borderColor: colors.border, padding: 20, marginBottom: 14 },
  heroName: { fontSize: 24, fontWeight: '800', color: colors.text, marginTop: 12 },
  heroSub: { fontSize: 14, color: colors.textSecondary, marginTop: 2 },
  stats: { flexDirection: 'row', gap: 10, marginTop: 16, alignSelf: 'stretch' },
  stat: { flex: 1, backgroundColor: colors.mint, borderRadius: 16, paddingVertical: 10, alignItems: 'center' },
  statValue: { fontSize: 15, fontWeight: '800', color: colors.ink },
  statLabel: { fontSize: 11, color: colors.textSecondary, marginTop: 2, fontWeight: '700' },
  uploading: { fontSize: 12, color: colors.textSecondary, marginTop: 10 },
  date: { fontSize: 14, fontWeight: '700', color: colors.ink },
  doc: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  diagnosis: { fontSize: 15, fontWeight: '700', color: colors.text, marginVertical: 8 },
  rx: { flexDirection: 'row', gap: 8, alignItems: 'center', paddingVertical: 3 },
  rxText: { flex: 1, fontSize: 13, color: colors.text },
}));
