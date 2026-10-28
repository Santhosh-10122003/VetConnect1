import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, Switch, TextInput, StyleSheet } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { colors } from '../../theme/colors';
import { shared } from '../../theme/shared';
import { careApi, Provider, ProviderHours } from '../../api/careApi';
import { AppHeader } from '../../components/common/AppHeader';
import { KeyboardScroll } from '../../components/common/KeyboardScroll';
import { AppInput } from '../../components/common/AppInput';
import { AppButton } from '../../components/common/AppButton';
import { LoadingView } from '../../components/common/LoadingView';
import { ProviderStackParamList } from '../../navigation/types';
import { getErrorMessage, notify } from '../../utils/helpers';

type Props = NativeStackScreenProps<ProviderStackParamList, 'ProviderHours'>;

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const hhmm = (t: string) => t.substring(0, 5);
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const SLOT_CHOICES = [15, 30, 45, 60];
const ADVANCE_CHOICES = [10, 20, 30, 50, 100];

export const ProviderHoursScreen: React.FC<Props> = ({ navigation }) => {
  const [profile, setProfile] = useState<Provider | null>(null);
  const [rows, setRows] = useState<{ isOpen: boolean; open: string; close: string }[]>([]);
  const [concurrent, setConcurrent] = useState('1');
  const [boardingCap, setBoardingCap] = useState('0');
  const [slot, setSlot] = useState(30);
  const [advance, setAdvance] = useState(30);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useFocusEffect(useCallback(() => {
    careApi.myProfile().then((p) => {
      setProfile(p);
      const byDay = new Map<number, ProviderHours>((p.hours ?? []).map((h) => [h.dayOfWeek, h]));
      setRows(DAYS.map((_, i) => {
        const h = byDay.get(i + 1);
        return { isOpen: h ? h.isOpen : false, open: h ? hhmm(h.openTime) : '09:00', close: h ? hhmm(h.closeTime) : '18:00' };
      }));
      setConcurrent(String(p.concurrentCapacity));
      setBoardingCap(String(p.boardingCapacity));
      setSlot(p.slotMinutes);
      setAdvance(p.advancePercent);
    }).catch((e) => notify('Error', getErrorMessage(e)));
  }, []));

  if (!profile) return <LoadingView />;
  const offersBoarding = profile.categories.includes('BOARDING');
  const setRow = (i: number, patch: Partial<(typeof rows)[number]>) => setRows((r) => r.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));

  const save = async () => {
    const errs: Record<string, string> = {};
    rows.forEach((r, i) => {
      if (!r.isOpen) return;
      if (!TIME.test(r.open) || !TIME.test(r.close)) errs[`day${i}`] = 'Use 24-hour times like 09:00';
      else if (r.open >= r.close) errs[`day${i}`] = 'Opening must be before closing';
    });
    const c = Number(concurrent);
    if (!(c >= 1 && c <= 50)) errs.concurrent = 'Between 1 and 50';
    const b = Number(boardingCap);
    if (offersBoarding && !(b >= 1 && b <= 500)) errs.boarding = 'Between 1 and 500';
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setSaving(true);
    try {
      await careApi.updateHours(rows.map((r, i) => ({ dayOfWeek: i + 1, isOpen: r.isOpen, openTime: r.open, closeTime: r.close })));
      await careApi.updateProfile({
        businessName: profile.businessName, description: profile.description, phone: profile.phone,
        registrationNumber: profile.registrationNumber, address: profile.address, city: profile.city, state: profile.state,
        country: profile.country, postalCode: profile.postalCode,
        latitude: profile.latitude ?? undefined, longitude: profile.longitude ?? undefined,
        categories: profile.categories, advancePercent: advance, concurrentCapacity: c,
        boardingCapacity: offersBoarding ? b : profile.boardingCapacity, slotMinutes: slot,
      });
      notify('Saved', 'Your hours and capacity were updated.');
      navigation.goBack();
    } catch (e) {
      notify('Could not save', getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={shared.screen}>
      <AppHeader title="Hours & capacity" showBack onBack={() => navigation.goBack()} />
      <KeyboardScroll contentContainerStyle={shared.content} keyboardShouldPersistTaps="handled">
        <Text style={shared.sectionTitle}>Opening hours</Text>
        {DAYS.map((d, i) => (
          <View key={d} style={[shared.card, { paddingVertical: 12 }]}>
            <View style={shared.rowBetween}>
              <Text style={styles.day}>{d}</Text>
              <Switch value={rows[i].isOpen} onValueChange={(v) => setRow(i, { isOpen: v })} testID={`open-${d}`} />
            </View>
            {rows[i].isOpen ? (
              <View style={styles.times}>
                <TextInput style={styles.time} value={rows[i].open} onChangeText={(v) => setRow(i, { open: v })} placeholder="09:00" maxLength={5} testID={`open-time-${d}`} />
                <Text style={styles.to}>to</Text>
                <TextInput style={styles.time} value={rows[i].close} onChangeText={(v) => setRow(i, { close: v })} placeholder="18:00" maxLength={5} testID={`close-time-${d}`} />
              </View>
            ) : (
              <Text style={styles.closed}>Closed</Text>
            )}
            {errors[`day${i}`] ? <Text style={styles.error}>{errors[`day${i}`]}</Text> : null}
          </View>
        ))}

        <Text style={[shared.sectionTitle, { marginTop: 8 }]}>Capacity</Text>
        <AppInput label="Pets you can handle at the same time (grooming, training)" value={concurrent} onChangeText={setConcurrent} keyboardType="number-pad" error={errors.concurrent} icon="people-outline" testID="capacity-concurrent" />
        {offersBoarding && (
          <AppInput label="Boarding places (pets overnight)" value={boardingCap} onChangeText={setBoardingCap} keyboardType="number-pad" error={errors.boarding} icon="bed-outline" testID="capacity-boarding" />
        )}

        <Text style={shared.label}>Booking slot length</Text>
        <View style={shared.chipRow}>
          {SLOT_CHOICES.map((m) => (
            <TouchableOpacity key={m} style={[shared.chip, slot === m && shared.chipActive]} onPress={() => setSlot(m)}>
              <Text style={[shared.chipText, slot === m && shared.chipTextActive]}>{m} min</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={shared.label}>Advance customers pay to book</Text>
        <View style={shared.chipRow}>
          {ADVANCE_CHOICES.map((p) => (
            <TouchableOpacity key={p} style={[shared.chip, advance === p && shared.chipActive]} onPress={() => setAdvance(p)} testID={`advance-${p}`}>
              <Text style={[shared.chipText, advance === p && shared.chipTextActive]}>{p}%</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.hint}>The rest is paid to you at the visit. If you reject or cancel a booking, the advance is refunded in full.</Text>

        <AppButton title="Save" onPress={save} loading={saving} />
      </KeyboardScroll>
    </View>
  );
};

const styles = StyleSheet.create({
  day: { fontSize: 15, fontWeight: '700', color: colors.text },
  times: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  time: { width: 90, height: 42, borderRadius: 10, borderWidth: 1, borderColor: colors.border, textAlign: 'center', fontSize: 15, backgroundColor: '#FFFFFF', color: colors.text },
  to: { color: colors.textSecondary },
  closed: { color: colors.textMuted, marginTop: 6, fontSize: 13 },
  error: { color: colors.danger, fontSize: 12, marginTop: 6 },
  hint: { fontSize: 12, color: colors.textSecondary, marginBottom: 16, lineHeight: 17 },
});
