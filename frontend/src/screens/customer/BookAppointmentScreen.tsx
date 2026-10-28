import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { doctorApi, DoctorProfile, AvailableSlot } from '../../api/doctorApi';
import { petApi, Pet } from '../../api/petApi';
import { appointmentApi } from '../../api/appointmentApi';
import { AppHeader } from '../../components/common/AppHeader';
import { PaymentMethods } from '../../components/payment/PaymentMethods';
import { KeyboardScroll } from '../../components/common/KeyboardScroll';
import { AppInput } from '../../components/common/AppInput';
import { AppButton } from '../../components/common/AppButton';
import { PetCard } from '../../components/pet/PetCard';
import { TimeSlotPicker } from '../../components/appointment/TimeSlotPicker';
import { LoadingView } from '../../components/common/LoadingView';
import { CustomerStackParamList } from '../../navigation/types';
import { drName, getClinicAdvancePercent, money } from '../../utils/helpers';
import { ClinicLocationCard } from '../../components/common/ClinicLocationCard';

type Props = NativeStackScreenProps<CustomerStackParamList, 'BookAppointment'>;

export const BookAppointmentScreen: React.FC<Props> = ({ navigation, route }) => {
  const { doctorId } = route.params;

  const [doctor, setDoctor] = useState<DoctorProfile | null>(null);
  const [pets, setPets] = useState<Pet[]>([]);
  const [selectedPetId, setSelectedPetId] = useState<number | null>(null);

  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [availableSlots, setAvailableSlots] = useState<AvailableSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null);

  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');

  const [loading, setLoading] = useState(true);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        const [docRes, petsRes] = await Promise.all([
          doctorApi.getDoctorById(doctorId),
          petApi.getMyPets(),
        ]);
        if (docRes.data) setDoctor(docRes.data);
        if (petsRes.data) {
          setPets(petsRes.data);
          if (petsRes.data.length > 0) {
            setSelectedPetId(petsRes.data[0].id);
          }
        }
      } catch (e) {
        console.warn('Init booking error', e);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [doctorId]);

  const fetchSlots = useCallback(async (date: string) => {
    setSlotsLoading(true);
    setSelectedSlot(null);
    try {
      const res = await doctorApi.getDoctorAvailability(doctorId, date);
      if (res.data) {
        setAvailableSlots(res.data);
      }
    } catch (e) {
      console.warn('Failed to load slots', e);
      setAvailableSlots([]);
    } finally {
      setSlotsLoading(false);
    }
  }, [doctorId]);

  useEffect(() => {
    if (doctor) {
      fetchSlots(selectedDate);
    }
  }, [doctor, selectedDate, fetchSlots]);

  const handleBooking = async () => {
    if (!selectedPetId) {
      Alert.alert('Pet Required', 'Please select a pet for this consultation.');
      return;
    }
    if (!selectedSlot) {
      Alert.alert('Time Slot Required', 'Please choose an available appointment time slot.');
      return;
    }
    if (!reason.trim()) {
      Alert.alert('Reason Required', 'Please describe the reason for your visit.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await appointmentApi.bookAppointment({
        doctorId,
        petId: selectedPetId,
        appointmentDate: selectedSlot.date,
        startTime: selectedSlot.startTime,
        endTime: selectedSlot.endTime,
        reason: reason.trim(),
        notes: notes.trim() || undefined,
      });

      if (res.data) {
        if (res.data.status === 'AWAITING_PAYMENT') navigation.replace('AppointmentPayment', { appointmentId: res.data.id });
        else navigation.replace('BookingSummary', { appointmentId: res.data.id });
      }
    } catch (err: any) {
      const message =
        err.response?.data?.message ||
        'Could not complete booking. Please try another slot.';
      Alert.alert('Booking Error', message);
      // Refresh slots in case of conflict
      fetchSlots(selectedDate);
    } finally {
      setSubmitting(false);
    }
  };

  // Half of the fee is paid up front (the share comes from the server's config); the rest is paid at the clinic.
  const advancePercent = getClinicAdvancePercent();
  const advanceDue = doctor ? Math.round(doctor.consultationFee * advancePercent) / 100 : 0;

  if (loading || !doctor) {
    return <LoadingView message="Preparing appointment scheduler..." />;
  }

  return (
    <View style={styles.container}>
      <AppHeader
        title="Book Appointment"
        subtitle={drName(doctor.fullName)}
        showBack
        onBack={() => navigation.goBack()}
      />

      <KeyboardScroll contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Doctor Banner */}
        <View style={styles.doctorBanner}>
          <Ionicons name="medical" size={20} color={colors.primary} />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.doctorName}>{drName(doctor.fullName)}</Text>
            <Text style={styles.clinicText}>{doctor.clinicName} • {money(doctor.consultationFee)}</Text>
          </View>
        </View>

        {/* Where the clinic is, with navigation */}
        <View style={styles.stepSection}>
          <Text style={styles.stepTitle}>Clinic location</Text>
          <View style={{ marginTop: 10 }}>
            <ClinicLocationCard
              clinicName={doctor.clinicName}
              address={doctor.clinicAddress}
              city={doctor.clinicCity}
              state={doctor.clinicState}
              country={doctor.clinicCountry}
              latitude={doctor.latitude}
              longitude={doctor.longitude}
              mapHeight={150}
            />
          </View>
        </View>

        {/* Step 1: Pet Selection */}
        <View style={styles.stepSection}>
          <View style={styles.stepHeader}>
            <View style={styles.stepNumber}><Text style={styles.stepNumberText}>1</Text></View>
            <Text style={styles.stepTitle}>Select Your Pet</Text>
          </View>

          {pets.length === 0 ? (
            <View style={styles.noPetBox}>
              <Text style={styles.noPetText}>You haven't added any pets yet.</Text>
              <TouchableOpacity
                style={styles.addPetBtn}
                onPress={() => navigation.navigate('AddEditPet', undefined)}
              >
                <Ionicons name="add" size={16} color="#FFFFFF" />
                <Text style={styles.addPetBtnText}>Add a Pet Now</Text>
              </TouchableOpacity>
            </View>
          ) : (
            pets.map((pet) => (
              <PetCard
                key={pet.id}
                pet={pet}
                selected={selectedPetId === pet.id}
                onPress={() => setSelectedPetId(pet.id)}
              />
            ))
          )}
        </View>

        {/* Step 2: Date & Slot Selection */}
        <View style={styles.stepSection}>
          <View style={styles.stepHeader}>
            <View style={styles.stepNumber}><Text style={styles.stepNumberText}>2</Text></View>
            <Text style={styles.stepTitle}>Choose Date & Time</Text>
          </View>

          <TimeSlotPicker
            slots={availableSlots}
            selectedSlot={selectedSlot}
            onSelectSlot={setSelectedSlot}
            selectedDate={selectedDate}
            onSelectDate={(newDate) => setSelectedDate(newDate)}
            loading={slotsLoading}
          />
        </View>

        {/* Step 3: Visit Details */}
        <View style={styles.stepSection}>
          <View style={styles.stepHeader}>
            <View style={styles.stepNumber}><Text style={styles.stepNumberText}>3</Text></View>
            <Text style={styles.stepTitle}>Reason for Visit</Text>
          </View>

          <AppInput
            label="Chief Concern / Symptoms *"
            placeholder="e.g. Skin scratching, annual vaccination booster, checkup..."
            value={reason}
            onChangeText={setReason}
            multiline
            numberOfLines={2}
            style={{ height: 60 }}
          />

          <AppInput
            label="Additional Notes for Doctor (Optional)"
            placeholder="Any behavioral notes or medication allergies to note..."
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={2}
            style={{ height: 60 }}
          />
        </View>

        {advanceDue > 0 && (
          <View style={styles.advanceBox} testID="advance-box">
            <View style={styles.advanceRow}><Text style={styles.advanceLabel}>Consultation fee</Text><Text style={styles.advanceValue}>{money(doctor.consultationFee)}</Text></View>
            <View style={styles.advanceRow}><Text style={styles.advanceLabel}>Pay now ({advancePercent}% advance)</Text><Text style={[styles.advanceValue, { color: colors.primary }]} testID="advance-due">{money(advanceDue)}</Text></View>
            <View style={styles.advanceRow}><Text style={styles.advanceLabel}>Pay at the clinic</Text><Text style={styles.advanceValue}>{money(doctor.consultationFee - advanceDue)}</Text></View>
          </View>
        )}

        {advanceDue > 0 && <PaymentMethods />}

        <AppButton
          title={selectedSlot ? (advanceDue > 0 ? `Continue to payment (${money(advanceDue)})` : `Confirm Booking (${selectedSlot.startTime.substring(0, 5)})`) : 'Select a Slot to Continue'}
          onPress={handleBooking}
          loading={submitting}
          disabled={!selectedSlot || !selectedPetId}
          style={styles.confirmBtn}
        />
      </KeyboardScroll>
    </View>
  );
};

const styles = StyleSheet.create({
  advanceBox: { backgroundColor: colors.mint, borderRadius: 14, padding: 14, marginBottom: 14, gap: 6, borderWidth: 1, borderColor: colors.mintBorder },
  advanceRow: { flexDirection: 'row', justifyContent: 'space-between' },
  advanceLabel: { fontSize: 13, color: colors.textSecondary },
  advanceValue: { fontSize: 14, fontWeight: '800', color: colors.text },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  doctorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
  },
  doctorName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  clinicText: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  stepSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    gap: 10,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  noPetBox: {
    padding: 20,
    backgroundColor: colors.mint,
    borderRadius: 12,
    alignItems: 'center',
  },
  noPetText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 12,
  },
  addPetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  addPetBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  confirmBtn: {
    marginTop: 8,
    marginBottom: 20,
  },
});
