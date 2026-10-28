import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Switch, StyleSheet } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors } from '../../theme/colors';
import { shared } from '../../theme/shared';
import { careApi, CareCategory, CATEGORIES, SIZES } from '../../api/careApi';
import { AppHeader } from '../../components/common/AppHeader';
import { KeyboardScroll } from '../../components/common/KeyboardScroll';
import { AppInput } from '../../components/common/AppInput';
import { AppButton } from '../../components/common/AppButton';
import { LoadingView } from '../../components/common/LoadingView';
import { ProviderStackParamList } from '../../navigation/types';
import { confirmAction, getErrorMessage, notify } from '../../utils/helpers';

type Props = NativeStackScreenProps<ProviderStackParamList, 'ProviderServiceEdit'>;

const num = (v: string) => (v.trim() === '' || isNaN(Number(v)) ? NaN : Number(v));

export const ProviderServiceEditScreen: React.FC<Props> = ({ navigation, route }) => {
  const serviceId = route.params?.serviceId;
  const [categories, setCategories] = useState<CareCategory[] | null>(null);
  const [category, setCategory] = useState<CareCategory>('GROOMING');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState('60');
  const [prices, setPrices] = useState({ SMALL: '', MEDIUM: '', LARGE: '', GIANT: '' });
  const [isAddon, setIsAddon] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const profile = await careApi.myProfile();
        setCategories(profile.categories);
        setCategory(profile.categories[0] ?? 'GROOMING');
        if (serviceId) {
          const s = (await careApi.myServices()).find((x) => x.id === serviceId);
          if (s) {
            setCategory(s.category); setName(s.name); setDescription(s.description ?? '');
            setDuration(s.durationMinutes ? String(s.durationMinutes) : '');
            setPrices({ SMALL: String(s.priceSmall), MEDIUM: String(s.priceMedium), LARGE: String(s.priceLarge), GIANT: String(s.priceGiant) });
            setIsAddon(s.isAddon); setIsActive(s.isActive);
          }
        }
      } catch (e) {
        notify('Error', getErrorMessage(e));
      }
    })();
  }, [serviceId]);

  if (!categories) return <LoadingView />;

  const boarding = category === 'BOARDING';
  const unit = boarding && !isAddon ? 'per night' : 'per session';

  const save = async () => {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Required';
    if (!boarding && !isAddon && !(Number(duration) >= 5)) errs.duration = 'At least 5 minutes';
    (['SMALL', 'MEDIUM', 'LARGE', 'GIANT'] as const).forEach((k) => {
      const v = num(prices[k]);
      if (isNaN(v) || v < 0) errs[k] = 'Enter a price';
    });
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setSaving(true);
    try {
      const payload = {
        category, name: name.trim(), description: description.trim() || undefined,
        durationMinutes: boarding || !duration ? undefined : Number(duration),
        priceSmall: Number(prices.SMALL), priceMedium: Number(prices.MEDIUM), priceLarge: Number(prices.LARGE), priceGiant: Number(prices.GIANT),
        isAddon, isActive,
      };
      if (serviceId) await careApi.updateService(serviceId, payload);
      else await careApi.addService(payload);
      navigation.goBack();
    } catch (e) {
      notify('Could not save', getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!serviceId) return;
    if (!(await confirmAction('Remove service', 'It will disappear from your menu. Existing bookings are not affected.', 'Remove', true))) return;
    try {
      await careApi.removeService(serviceId);
      navigation.goBack();
    } catch (e) {
      notify('Could not remove', getErrorMessage(e));
    }
  };

  return (
    <View style={shared.screen}>
      <AppHeader title={serviceId ? 'Edit service' : 'Add a service'} showBack onBack={() => navigation.goBack()} />
      <KeyboardScroll contentContainerStyle={shared.content} keyboardShouldPersistTaps="handled">
        <Text style={shared.label}>Category</Text>
        <View style={shared.chipRow}>
          {CATEGORIES.filter((c) => categories.includes(c.key)).map((c) => (
            <TouchableOpacity key={c.key} style={[shared.chip, category === c.key && shared.chipActive]} onPress={() => setCategory(c.key)}>
              <Text style={[shared.chipText, category === c.key && shared.chipTextActive]}>{c.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <AppInput label="Name *" placeholder={boarding ? 'e.g. Standard Boarding' : 'e.g. Full Groom'} value={name} onChangeText={setName} error={errors.name} />
        <AppInput label="Description" value={description} onChangeText={setDescription} multiline style={{ height: 80, textAlignVertical: 'top', paddingTop: 12 }} />

        <View style={[shared.card, styles.switchRow]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.switchTitle}>This is an extra</Text>
            <Text style={styles.switchSub}>Booked together with a main service, at a flat price (e.g. nail trim, extra walk).</Text>
          </View>
          <Switch value={isAddon} onValueChange={setIsAddon} testID="switch-addon" />
        </View>

        {!boarding && (
          <AppInput label={isAddon ? 'Extra time it takes (minutes, optional)' : 'How long one session takes (minutes) *'} value={duration} onChangeText={setDuration} keyboardType="number-pad" error={errors.duration} icon="time-outline" />
        )}

        <Text style={shared.sectionTitle}>Price {unit}, by pet size</Text>
        {SIZES.map((s) => (
          <AppInput
            key={s.key}
            label={`${s.label} (${s.hint})`}
            value={prices[s.key]}
            onChangeText={(v) => setPrices((p) => ({ ...p, [s.key]: v }))}
            keyboardType="decimal-pad"
            error={errors[s.key]}
            testID={`price-${s.key}`}
            icon="cash-outline"
          />
        ))}
        <TouchableOpacity onPress={() => setPrices({ SMALL: prices.SMALL, MEDIUM: prices.SMALL, LARGE: prices.SMALL, GIANT: prices.SMALL })} style={{ marginBottom: 14 }}>
          <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 13 }}>Use the small price for every size</Text>
        </TouchableOpacity>

        <View style={[shared.card, styles.switchRow]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.switchTitle}>Available to book</Text>
            <Text style={styles.switchSub}>Switch off to hide it from customers without deleting it.</Text>
          </View>
          <Switch value={isActive} onValueChange={setIsActive} />
        </View>

        <AppButton title="Save service" onPress={save} loading={saving} />
        {serviceId ? (
          <AppButton title="Remove from menu" variant="outline" textStyle={{ color: colors.danger }} style={{ borderColor: colors.danger, marginTop: 10 }} onPress={remove} />
        ) : null}
      </KeyboardScroll>
    </View>
  );
};

const styles = StyleSheet.create({
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  switchTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  switchSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2, lineHeight: 17 },
});
