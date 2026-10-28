import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { shared } from '../../theme/shared';
import { medicalApi } from '../../api/medicalApi';
import { appointmentApi } from '../../api/appointmentApi';
import { AppHeader } from '../../components/common/AppHeader';
import { KeyboardScroll } from '../../components/common/KeyboardScroll';
import { AppInput } from '../../components/common/AppInput';
import { AppButton } from '../../components/common/AppButton';
import { DoctorStackParamList } from '../../navigation/types';
import { getErrorMessage, notify } from '../../utils/helpers';

type Props = NativeStackScreenProps<DoctorStackParamList, 'ConsultationNotes'>;

interface RxRow {
  medicationName: string;
  dosage: string;
  frequency: string;
  durationDays: string;
  instructions: string;
}

const emptyRx = (): RxRow => ({ medicationName: '', dosage: '', frequency: '', durationDays: '', instructions: '' });

export const ConsultationNotesScreen: React.FC<Props> = ({ navigation, route }) => {
  const { appointmentId, petId, petName } = route.params;
  const [diagnosis, setDiagnosis] = useState('');
  const [symptoms, setSymptoms] = useState('');
  const [notes, setNotes] = useState('');
  const [plan, setPlan] = useState('');
  const [weight, setWeight] = useState('');
  const [rx, setRx] = useState<RxRow[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const updateRx = (i: number, patch: Partial<RxRow>) => setRx((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!diagnosis.trim()) errs.diagnosis = 'Diagnosis is required';
    if (weight && (isNaN(Number(weight)) || Number(weight) <= 0)) errs.weight = 'Enter a valid weight';
    rx.forEach((r, i) => {
      if (!r.medicationName.trim()) errs[`rx${i}`] = 'Medication name is required';
      else if (r.durationDays && (!/^\d+$/.test(r.durationDays) || Number(r.durationDays) < 1)) errs[`rx${i}`] = 'Duration must be a whole number of days';
    });
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const submit = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      await medicalApi.createMedicalRecord(petId, {
        appointmentId,
        diagnosis: diagnosis.trim(),
        symptoms: symptoms.trim() || undefined,
        clinicalNotes: notes.trim() || undefined,
        treatmentPlan: plan.trim() || undefined,
        weightAtVisit: weight ? Number(weight) : undefined,
        prescriptions: rx.map((r) => ({
          medicationName: r.medicationName.trim(),
          dosage: r.dosage.trim(),
          frequency: r.frequency.trim(),
          durationDays: r.durationDays ? Number(r.durationDays) : 0,
          instructions: r.instructions.trim() || undefined,
        })),
      });
    } catch (e) {
      setSaving(false);
      return notify('Could not save consultation', getErrorMessage(e));
    }
    try {
      await appointmentApi.completeAppointment(appointmentId);
    } catch (e) {
      setSaving(false);
      // The record is already stored; tell the doctor exactly what remains.
      return notify('Notes saved, appointment not completed', `${getErrorMessage(e)} You can complete it from the appointment screen.`);
    }
    setSaving(false);
    notify('Consultation completed', `${petName}'s record has been saved and the owner notified.`);
    navigation.popToTop();
  };

  return (
    <View style={shared.screen}>
      <AppHeader title="Consultation Notes" subtitle={petName} showBack onBack={() => navigation.goBack()} />
      <KeyboardScroll contentContainerStyle={shared.content} keyboardShouldPersistTaps="handled">
        <AppInput label="Diagnosis *" value={diagnosis} onChangeText={setDiagnosis} error={errors.diagnosis} placeholder="e.g. Seasonal dermatitis" />
        <AppInput label="Symptoms" value={symptoms} onChangeText={setSymptoms} multiline style={styles.multi} />
        <AppInput label="Clinical notes" value={notes} onChangeText={setNotes} multiline style={styles.multi} />
        <AppInput label="Treatment plan" value={plan} onChangeText={setPlan} multiline style={styles.multi} />
        <AppInput label="Weight at visit (kg)" icon="scale-outline" value={weight} onChangeText={setWeight} keyboardType="decimal-pad" error={errors.weight} />

        <View style={shared.rowBetween}>
          <Text style={shared.sectionTitle}>Prescriptions</Text>
          <TouchableOpacity style={styles.addBtn} onPress={() => setRx((r) => [...r, emptyRx()])}>
            <Ionicons name="add" size={18} color={colors.primary} />
            <Text style={styles.addText}>Add drug</Text>
          </TouchableOpacity>
        </View>

        {rx.length === 0 && <Text style={styles.hint}>No medication prescribed. Tap “Add drug” to add one.</Text>}

        {rx.map((r, i) => (
          <View key={i} style={shared.card}>
            <View style={shared.rowBetween}>
              <Text style={styles.rxTitle}>Medication {i + 1}</Text>
              <TouchableOpacity onPress={() => setRx((rows) => rows.filter((_, idx) => idx !== i))}>
                <Ionicons name="trash-outline" size={20} color={colors.danger} />
              </TouchableOpacity>
            </View>
            <AppInput label="Drug name" value={r.medicationName} onChangeText={(v) => updateRx(i, { medicationName: v })} error={errors[`rx${i}`]} />
            <AppInput label="Dosage" value={r.dosage} onChangeText={(v) => updateRx(i, { dosage: v })} placeholder="e.g. 250 mg" />
            <AppInput label="Frequency" value={r.frequency} onChangeText={(v) => updateRx(i, { frequency: v })} placeholder="e.g. Twice daily" />
            <AppInput label="Duration (days)" value={r.durationDays} onChangeText={(v) => updateRx(i, { durationDays: v })} keyboardType="number-pad" />
            <AppInput label="Special instructions" value={r.instructions} onChangeText={(v) => updateRx(i, { instructions: v })} />
          </View>
        ))}

        <AppButton title="Save & Complete Appointment" onPress={submit} loading={saving} />
      </KeyboardScroll>
    </View>
  );
};

const styles = StyleSheet.create({
  multi: { height: 90, textAlignVertical: 'top', paddingTop: 12 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, backgroundColor: colors.mint },
  addText: { color: colors.primary, fontWeight: '700', fontSize: 13 },
  hint: { fontSize: 13, color: colors.textSecondary, marginBottom: 16 },
  rxTitle: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 10 },
});
