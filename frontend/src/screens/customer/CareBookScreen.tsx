import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { shared } from '../../theme/shared';
import { careApi, BoardingNight, PetSize, Provider, SIZES, Slot, priceForSize, sizeFromWeight } from '../../api/careApi';
import { petApi, Pet } from '../../api/petApi';
import { AppHeader } from '../../components/common/AppHeader';
import { PaymentMethods } from '../../components/payment/PaymentMethods';
import { KeyboardScroll } from '../../components/common/KeyboardScroll';
import { AppButton } from '../../components/common/AppButton';
import { AppInput } from '../../components/common/AppInput';
import { DateField, toIso } from '../../components/common/DateField';
import { LoadingView } from '../../components/common/LoadingView';
import { PetCard } from '../../components/pet/PetCard';
import { CustomerStackParamList } from '../../navigation/types';
import { getErrorMessage, hhmm, money, notify } from '../../utils/helpers';

type Props = NativeStackScreenProps<CustomerStackParamList, 'CareBook'>;

const addDays = (iso: string, n: number) => {
  const [y, m, d] = iso.split('-').map(Number);
  return toIso(new Date(y, m - 1, d + n));
};

const Step: React.FC<{ n: number; title: string; children: React.ReactNode }> = ({ n, title, children }) => (
  <View style={styles.step}>
    <View style={styles.stepHead}>
      <View style={styles.stepNum}><Text style={styles.stepNumText}>{n}</Text></View>
      <Text style={styles.stepTitle}>{title}</Text>
    </View>
    {children}
  </View>
);

export const CareBookScreen: React.FC<Props> = ({ navigation, route }) => {
  const { providerId, serviceId } = route.params;
  const today = useMemo(() => toIso(new Date()), []);

  const [provider, setProvider] = useState<Provider | null>(null);
  const [pets, setPets] = useState<Pet[]>([]);
  const [petId, setPetId] = useState<number | null>(null);
  const [size, setSize] = useState<PetSize>('MEDIUM');
  const [addons, setAddons] = useState<number[]>([]);
  const [date, setDate] = useState(addDays(today, 1));
  const [checkOut, setCheckOut] = useState(addDays(today, 2));
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slot, setSlot] = useState<string | null>(null);
  const [nights, setNights] = useState<BoardingNight[]>([]);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const service = provider?.services?.find((s) => s.id === serviceId);
  const boarding = service?.category === 'BOARDING';
  const extras = (provider?.services ?? []).filter((s) => s.isAddon && s.category === service?.category);

  useEffect(() => {
    careApi.provider(providerId).then(setProvider).catch((e) => { notify('Not available', getErrorMessage(e)); navigation.goBack(); });
  }, [providerId, navigation]);

  useFocusEffect(useCallback(() => {
    petApi.getMyPets().then((r) => {
      setPets(r.data);
      setPetId((cur) => cur ?? r.data[0]?.id ?? null);
    }).catch(() => {});
  }, []));

  // the size follows the chosen pet's weight, and can still be changed by hand
  useEffect(() => {
    const pet = pets.find((p) => p.id === petId);
    if (pet) setSize(sizeFromWeight(pet.weight));
  }, [petId, pets]);

  useEffect(() => {
    if (!service || boarding) return;
    setSlotsLoading(true);
    setSlot(null);
    careApi.slots(providerId, serviceId, date).then(setSlots).catch(() => setSlots([])).finally(() => setSlotsLoading(false));
  }, [providerId, serviceId, date, service, boarding]);

  useEffect(() => {
    if (!boarding) return;
    if (checkOut <= date) { setNights([]); return; }
    careApi.boardingNights(providerId, date, checkOut).then(setNights).catch(() => setNights([]));
  }, [providerId, date, checkOut, boarding]);

  if (!provider || !service) return <LoadingView />;

  const nightCount = boarding && checkOut > date
    ? Math.round((new Date(checkOut).getTime() - new Date(date).getTime()) / 86400000) : 1;
  const mainPrice = priceForSize(service, size) * (service.pricingUnit === 'PER_NIGHT' ? nightCount : 1);
  const chosenExtras = extras.filter((e) => addons.includes(e.id));
  const total = mainPrice + chosenExtras.reduce((sum, e) => sum + priceForSize(e, size), 0);
  const advance = Math.min(total, Math.max(0.01, Math.round(total * provider.advancePercent) / 100));
  const fullNights = nights.filter((n) => !n.available).length;
  const lowest = nights.length ? Math.min(...nights.map((n) => n.remaining)) : null;

  const submit = async () => {
    setError(null);
    if (petId == null) return setError('Add a pet first, then choose it here.');
    if (boarding) {
      if (checkOut <= date) return setError('Check-out must be after check-in.');
      if (fullNights > 0) return setError('Some of those nights are full. Please choose other dates.');
    } else if (!slot) {
      return setError('Choose a time slot.');
    }
    setSaving(true);
    try {
      const booking = await careApi.createBooking({
        providerId, serviceId, petId, petSize: size, addonIds: addons, date,
        startTime: boarding ? undefined : slot ?? undefined,
        checkOutDate: boarding ? checkOut : undefined,
        notes: notes.trim() || undefined,
      });
      navigation.replace('CarePayment', { bookingId: booking.id });
    } catch (e) {
      setError(getErrorMessage(e, 'Could not create the booking.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={shared.screen}>
      <AppHeader title="Book" subtitle={`${provider.businessName} · ${service.name}`} showBack onBack={() => navigation.goBack()} />
      <KeyboardScroll contentContainerStyle={shared.content} keyboardShouldPersistTaps="handled">
        <Step n={1} title="Your pet">
          {pets.length === 0 ? (
            <View style={shared.card}>
              <Text style={styles.muted}>You have not added a pet yet.</Text>
              <AppButton title="Add a pet" onPress={() => navigation.navigate('AddEditPet', undefined)} />
            </View>
          ) : (
            pets.map((p) => <PetCard key={p.id} pet={p} selected={petId === p.id} onPress={() => setPetId(p.id)} />)
          )}
          <Text style={shared.label}>Size (sets the price)</Text>
          <View style={shared.chipRow}>
            {SIZES.map((s) => (
              <TouchableOpacity key={s.key} style={[shared.chip, size === s.key && shared.chipActive]} onPress={() => setSize(s.key)} testID={`size-${s.key}`}>
                <Text style={[shared.chipText, size === s.key && shared.chipTextActive]}>{s.label} · {s.hint}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Step>

        {extras.length > 0 && (
          <Step n={2} title="Extras (optional)">
            {extras.map((e) => {
              const on = addons.includes(e.id);
              return (
                <TouchableOpacity key={e.id} style={[styles.extra, on && styles.extraOn]} onPress={() => setAddons((a) => (on ? a.filter((x) => x !== e.id) : [...a, e.id]))} testID={`extra-${e.name}`}>
                  <Ionicons name={on ? 'checkbox' : 'square-outline'} size={22} color={on ? colors.primary : colors.textMuted} />
                  <Text style={styles.extraName}>{e.name}{e.durationMinutes ? ` (+${e.durationMinutes} min)` : ''}</Text>
                  <Text style={styles.extraPrice}>+{money(priceForSize(e, size))}</Text>
                </TouchableOpacity>
              );
            })}
          </Step>
        )}

        {boarding ? (
          <Step n={extras.length > 0 ? 3 : 2} title="Check-in and check-out">
            <DateField label="Check-in" value={date} minimumDate={new Date(new Date().setHours(0, 0, 0, 0))} onChange={(v) => { if (v) { setDate(v); if (checkOut <= v) setCheckOut(addDays(v, 1)); } }} testID="checkin" />
            <DateField label="Check-out" value={checkOut} minimumDate={new Date(new Date(date).getTime() + 86400000)} onChange={(v) => v && setCheckOut(v)} testID="checkout" />
            <Text style={[styles.muted, fullNights > 0 && { color: colors.danger }]}>
              {nightCount} night{nightCount === 1 ? '' : 's'}.{' '}
              {nights.length === 0 ? '' : fullNights > 0 ? `${fullNights} of those nights ${fullNights === 1 ? 'is' : 'are'} full.` : `Places left: ${lowest}.`}
            </Text>
          </Step>
        ) : (
          <Step n={extras.length > 0 ? 3 : 2} title="Date and time">
            <DateField label="Date" value={date} minimumDate={new Date(new Date().setHours(0, 0, 0, 0))} onChange={(v) => v && setDate(v)} testID="care-date" />
            {slotsLoading ? (
              <Text style={styles.muted}>Loading times...</Text>
            ) : slots.length === 0 ? (
              <Text style={styles.muted}>Closed or no times on this day. Please choose another date.</Text>
            ) : (
              <View style={styles.slots}>
                {slots.map((s) => (
                  <TouchableOpacity
                    key={s.startTime}
                    disabled={!s.available}
                    style={[styles.slot, !s.available && styles.slotOff, slot === s.startTime && styles.slotOn]}
                    onPress={() => setSlot(s.startTime)}
                    testID={`slot-${hhmm(s.startTime)}`}
                  >
                    <Text style={[styles.slotText, !s.available && { color: colors.textMuted, textDecorationLine: 'line-through' }, slot === s.startTime && { color: '#FFFFFF' }]}>{hhmm(s.startTime)}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </Step>
        )}

        <Step n={extras.length > 0 ? 4 : 3} title="Notes for the provider (optional)">
          <AppInput placeholder="e.g. Nervous around dryers, allergic to a shampoo..." value={notes} onChangeText={setNotes} multiline style={{ height: 80, textAlignVertical: 'top', paddingTop: 12 }} />
        </Step>

        <View style={styles.summary} testID="care-summary">
          <Text style={shared.sectionTitle}>Price</Text>
          <View style={shared.rowBetween}><Text style={styles.sLabel}>{service.name}{service.pricingUnit === 'PER_NIGHT' ? ` x ${nightCount} night${nightCount === 1 ? '' : 's'}` : ''}</Text><Text style={styles.sValue}>{money(mainPrice)}</Text></View>
          {chosenExtras.map((e) => (
            <View key={e.id} style={shared.rowBetween}><Text style={styles.sLabel}>{e.name}</Text><Text style={styles.sValue}>{money(priceForSize(e, size))}</Text></View>
          ))}
          <View style={[shared.rowBetween, styles.totalRow]}><Text style={styles.total}>Total</Text><Text style={styles.total}>{money(total)}</Text></View>
          <View style={styles.dueNow}>
            <View style={shared.rowBetween}><Text style={styles.dueLabel}>Pay now ({provider.advancePercent}% advance)</Text><Text style={styles.dueValue} testID="advance-due">{money(advance)}</Text></View>
            <Text style={styles.sLabel}>Pay at the visit: {money(total - advance)}</Text>
          </View>
        </View>

        <PaymentMethods />

        {error ? <Text style={styles.error}>{error}</Text> : null}
        <AppButton title={`Continue to payment (${money(advance)})`} onPress={submit} loading={saving} testID="care-continue" />
      </KeyboardScroll>
    </View>
  );
};

const styles = StyleSheet.create({
  step: { marginBottom: 20 },
  stepHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  stepNum: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  stepNumText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },
  stepTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  muted: { fontSize: 12, color: colors.textSecondary, marginBottom: 8, lineHeight: 17 },
  extra: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, marginBottom: 8 },
  extraOn: { borderColor: colors.primary, backgroundColor: colors.mint },
  extraName: { flex: 1, fontSize: 14, color: colors.text, fontWeight: '600' },
  extraPrice: { fontSize: 13, fontWeight: '800', color: colors.primary },
  slots: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  slot: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  slotOff: { backgroundColor: colors.background },
  slotOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  slotText: { fontSize: 13, fontWeight: '700', color: colors.text },
  summary: { backgroundColor: colors.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border, marginBottom: 14, gap: 6 },
  sLabel: { fontSize: 13, color: colors.textSecondary },
  sValue: { fontSize: 13, fontWeight: '700', color: colors.text },
  totalRow: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8, marginTop: 4 },
  total: { fontSize: 16, fontWeight: '800', color: colors.text },
  dueNow: { backgroundColor: colors.mint, borderRadius: 12, padding: 12, marginTop: 6, gap: 4 },
  dueLabel: { fontSize: 13, fontWeight: '700', color: colors.text },
  dueValue: { fontSize: 18, fontWeight: '800', color: colors.primary },
  error: { color: colors.danger, marginBottom: 10, fontSize: 13 },
});
