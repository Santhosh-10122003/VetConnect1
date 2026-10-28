import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, SafeAreaView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { colors } from '../../theme/colors';
import { AppInput } from './AppInput';
import { SelectField, SelectOption } from './SelectField';
import { OsmMap } from './OsmMap';
import { geoApi, Country, GeoPlace, StateItem } from '../../api/geoApi';
import { getErrorMessage } from '../../utils/helpers';

export interface LocationValue {
  countryCode?: string;
  country: string;
  stateCode?: string;
  state: string;
  /** The district (or city). This is what customers and clinics are matched on. */
  city: string;
  postalCode: string;
  latitude?: number;
  longitude?: number;
}

export const emptyLocation: LocationValue = { country: '', state: '', city: '', postalCode: '' };

export interface LocationErrors {
  country?: string;
  state?: string;
  city?: string;
  pin?: string;
}

interface Props {
  value: LocationValue;
  onChange: (next: LocationValue) => void;
  /** Doctors must pin the clinic so customers can navigate to it. */
  pinRequired?: boolean;
  districtLabel?: string;
  errors?: LocationErrors;
}

const sameName = (a?: string, b?: string) => (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase();

/**
 * Where a person or a clinic is: pick country, state and district from dropdowns, or type a postal code,
 * or use GPS, or drop a pin on the map. Whatever is chosen fills in the rest.
 */
export const LocationPicker: React.FC<Props> = ({ value, onChange, pinRequired, districtLabel = 'District / City *', errors }) => {
  const [countries, setCountries] = useState<Country[]>([]);
  const [states, setStates] = useState<StateItem[]>([]);
  const [districts, setDistricts] = useState<string[]>([]);
  const [loadingLists, setLoadingLists] = useState({ countries: true, states: false, districts: false });
  const [busy, setBusy] = useState<'postal' | 'gps' | null>(null);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [mapOpen, setMapOpen] = useState(false);

  // Always read the latest value when several async results arrive close together.
  const latest = useRef(value);
  latest.current = value;
  const emit = (patch: Partial<LocationValue>) => {
    latest.current = { ...latest.current, ...patch };
    onChange(latest.current);
  };

  // ---- lists
  useEffect(() => {
    geoApi.countries().then(setCountries).catch(() => setMessage({ text: 'Could not load the country list.', error: true }))
      .finally(() => setLoadingLists((l) => ({ ...l, countries: false })));
  }, []);

  // A saved profile only has names: find the codes once the lists are known.
  useEffect(() => {
    if (value.country && !value.countryCode && countries.length) {
      const c = countries.find((x) => sameName(x.name, value.country));
      if (c) emit({ countryCode: c.code });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countries, value.country, value.countryCode]);

  useEffect(() => {
    if (!value.countryCode) { setStates([]); return; }
    setLoadingLists((l) => ({ ...l, states: true }));
    geoApi.states(value.countryCode).then(setStates).catch(() => setStates([]))
      .finally(() => setLoadingLists((l) => ({ ...l, states: false })));
  }, [value.countryCode]);

  useEffect(() => {
    if (value.state && !value.stateCode && states.length) {
      const s = states.find((x) => sameName(x.name, value.state));
      if (s) emit({ stateCode: s.code });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [states, value.state, value.stateCode]);

  useEffect(() => {
    if (!value.countryCode || !value.stateCode) { setDistricts([]); return; }
    setLoadingLists((l) => ({ ...l, districts: true }));
    geoApi.districts(value.countryCode, value.stateCode).then(setDistricts).catch(() => setDistricts([]))
      .finally(() => setLoadingLists((l) => ({ ...l, districts: false })));
  }, [value.countryCode, value.stateCode]);

  const countryOptions: SelectOption[] = useMemo(() => countries.map((c) => ({ value: c.code, label: c.name })), [countries]);
  const stateOptions: SelectOption[] = useMemo(() => states.map((s) => ({ value: s.code, label: s.name })), [states]);
  const districtOptions: SelectOption[] = useMemo(() => {
    const list = districts.map((d) => ({ value: d, label: d }));
    // a place that came from a lookup or an older profile may not be in the dataset: keep it selectable
    if (value.city && !districts.some((d) => sameName(d, value.city))) list.unshift({ value: value.city, label: value.city });
    return list;
  }, [districts, value.city]);

  // ---- applying a place found by postal code, GPS or map pin
  const applyPlace = (place: GeoPlace, exact?: { lat: number; lng: number }) => {
    emit({
      countryCode: place.countryCode ?? latest.current.countryCode,
      country: place.country ?? latest.current.country,
      stateCode: place.stateCode,
      state: place.state ?? '',
      city: place.district ?? '',
      postalCode: place.postalCode ?? latest.current.postalCode,
      latitude: exact?.lat ?? place.latitude,
      longitude: exact?.lng ?? place.longitude,
    });
  };

  const findByPostalCode = async () => {
    const code = value.postalCode.trim();
    if (!value.countryCode) return setMessage({ text: 'Choose the country first, then enter the postal code.', error: true });
    if (code.length < 3) return setMessage({ text: 'Enter a valid postal code.', error: true });
    setBusy('postal');
    setMessage(null);
    try {
      const place = await geoApi.postalCode(value.countryCode, code);
      applyPlace(place);
      setMessage({ text: `Found ${[place.district, place.state].filter(Boolean).join(', ')}. Tap "Pin on map" to fine-tune the exact spot.` });
    } catch (e) {
      setMessage({ text: getErrorMessage(e, 'Could not look up that postal code.'), error: true });
    } finally {
      setBusy(null);
    }
  };

  const useMyLocation = async () => {
    setBusy('gps');
    setMessage(null);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') {
        setMessage({ text: 'Location permission was denied. Choose your place from the lists, or use a postal code or the map.', error: true });
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const exact = { lat: Number(pos.coords.latitude.toFixed(6)), lng: Number(pos.coords.longitude.toFixed(6)) };
      try {
        applyPlace(await geoApi.reverse(exact.lat, exact.lng), exact);
        setMessage({ text: 'Location set from GPS. You can fine-tune it on the map.' });
      } catch {
        emit({ latitude: exact.lat, longitude: exact.lng });
        setMessage({ text: 'Your position is saved. Please choose the district from the list.' });
      }
    } catch (e) {
      setMessage({ text: getErrorMessage(e, 'Could not get your location.'), error: true });
    } finally {
      setBusy(null);
    }
  };

  const onMapConfirm = async (lat: number, lng: number) => {
    setMapOpen(false);
    const exact = { lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) };
    emit({ latitude: exact.lat, longitude: exact.lng });
    try {
      applyPlace(await geoApi.reverse(exact.lat, exact.lng), exact);
      setMessage({ text: 'Pinned. Country, state and district were filled in from the map.' });
    } catch {
      setMessage({ text: 'Pin saved. Please check the country, state and district above.' });
    }
  };

  const hasPin = value.latitude != null && value.longitude != null;

  return (
    <View>
      <SelectField
        testID="loc-country"
        label="Country *"
        placeholder="Select country"
        icon="earth-outline"
        value={value.countryCode}
        displayValue={value.country}
        options={countryOptions}
        loading={loadingLists.countries}
        searchPlaceholder="Search country"
        error={errors?.country}
        onSelect={(o) =>
          // a different place: forget everything that belonged to the old one, including the pin
          emit({ countryCode: o.value, country: o.label, stateCode: undefined, state: '', city: '', latitude: undefined, longitude: undefined })
        }
      />
      <SelectField
        testID="loc-state"
        label="State / Province *"
        placeholder={value.countryCode ? 'Select state' : 'Select a country first'}
        icon="map-outline"
        value={value.stateCode}
        displayValue={value.state}
        options={stateOptions}
        disabled={!value.countryCode}
        loading={loadingLists.states}
        searchPlaceholder="Search state"
        error={errors?.state}
        onSelect={(o) => emit({ stateCode: o.value, state: o.label, city: '', latitude: undefined, longitude: undefined })}
      />
      <SelectField
        testID="loc-district"
        label={districtLabel}
        placeholder={value.stateCode ? 'Select district' : 'Select a state first'}
        icon="location-outline"
        value={value.city}
        displayValue={value.city}
        options={districtOptions}
        disabled={!value.stateCode && !value.city}
        loading={loadingLists.districts}
        searchPlaceholder="Search district or city"
        error={errors?.city}
        onSelect={(o) => emit({ city: o.value, latitude: undefined, longitude: undefined })}
      />

      <Text style={styles.label}>Postal / PIN code</Text>
      <View style={styles.pinRow}>
        <View style={{ flex: 1 }}>
          <AppInput
            testID="loc-postal"
            placeholder="e.g. 641001"
            value={value.postalCode}
            onChangeText={(v) => emit({ postalCode: v })}
            autoCapitalize="characters"
            autoCorrect={false}
            icon="mail-open-outline"
          />
        </View>
        <TouchableOpacity style={styles.findBtn} onPress={findByPostalCode} disabled={busy !== null} testID="loc-find">
          {busy === 'postal' ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.findText}>Find</Text>}
        </TouchableOpacity>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionBtn} onPress={useMyLocation} disabled={busy !== null} testID="loc-gps">
          {busy === 'gps' ? <ActivityIndicator size="small" color={colors.primary} /> : <Ionicons name="navigate-outline" size={18} color={colors.primary} />}
          <Text style={styles.actionText}>Use my current location</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => setMapOpen(true)} testID="loc-map">
          <Ionicons name="pin-outline" size={18} color={colors.primary} />
          <Text style={styles.actionText}>{hasPin ? 'Change pin on map' : 'Pin on map'}</Text>
        </TouchableOpacity>
      </View>

      {message ? <Text style={[styles.message, message.error && styles.messageError]}>{message.text}</Text> : null}

      <View style={[styles.pinStatus, hasPin ? styles.pinOk : (pinRequired && errors?.pin) ? styles.pinBad : null]}>
        <Ionicons
          name={hasPin ? 'checkmark-circle' : 'pin-outline'}
          size={18}
          color={hasPin ? colors.success : errors?.pin ? colors.danger : colors.textMuted}
        />
        <Text style={styles.pinStatusText} testID="loc-pin-status">
          {hasPin
            ? `Pinned at ${value.latitude!.toFixed(5)}, ${value.longitude!.toFixed(5)}`
            : pinRequired
              ? errors?.pin || 'Pin your clinic on the map so pet owners can navigate to you.'
              : 'No map pin yet (optional): add one to see distances to clinics.'}
        </Text>
      </View>

      <MapPickerModal
        visible={mapOpen}
        initialLat={value.latitude}
        initialLng={value.longitude}
        countryCode={value.countryCode}
        state={value.state}
        district={value.city}
        onClose={() => setMapOpen(false)}
        onConfirm={onMapConfirm}
      />
    </View>
  );
};

/** Full-screen map: tap or drag the marker, then confirm. */
const MapPickerModal: React.FC<{
  visible: boolean;
  initialLat?: number;
  initialLng?: number;
  countryCode?: string;
  state?: string;
  district?: string;
  onClose: () => void;
  onConfirm: (lat: number, lng: number) => void;
}> = ({ visible, initialLat, initialLng, countryCode, state, district, onClose, onConfirm }) => {
  const [pick, setPick] = useState<{ lat: number; lng: number } | null>(null);
  const [center, setCenter] = useState<{ lat: number; lng: number; zoom?: number } | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!visible) { setReady(false); return; }
    const hasPin = initialLat != null && initialLng != null;
    setPick(hasPin ? { lat: initialLat as number, lng: initialLng as number } : null);
    setCenter(null);
    if (hasPin || !countryCode || !district) { setReady(true); return; }
    // No pin yet: open the map on the chosen district instead of on the whole world.
    let cancelled = false;
    geoApi.place(countryCode, state ?? "", district)
      .then((p) => { if (!cancelled && p.latitude != null && p.longitude != null) setCenter({ lat: p.latitude, lng: p.longitude, zoom: 12 }); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setReady(true); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.modal}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Pin the exact location</Text>
          <TouchableOpacity onPress={onClose} hitSlop={10} accessibilityLabel="Close map">
            <Ionicons name="close" size={26} color={colors.text} />
          </TouchableOpacity>
        </View>
        <Text style={styles.modalHint}>Tap the map, or drag the marker. Zoom in for accuracy.</Text>
        <View style={{ flex: 1, paddingHorizontal: 12 }}>
          {visible && !ready && <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />}
          {visible && ready && (
            <OsmMap
              interactive
              latitude={initialLat}
              longitude={initialLng}
              fill
              center={center}
              zoom={16}
              onPick={(lat, lng) => setPick({ lat, lng })}
            />
          )}
        </View>
        <View style={styles.modalFooter}>
          <Text style={styles.coords}>{pick ? `${pick.lat.toFixed(5)}, ${pick.lng.toFixed(5)}` : 'Nothing pinned yet'}</Text>
          <TouchableOpacity
            style={[styles.confirmBtn, !pick && { opacity: 0.4 }]}
            disabled={!pick}
            onPress={() => pick && onConfirm(pick.lat, pick.lng)}
            testID="map-confirm"
          >
            <Text style={styles.confirmText}>Confirm location</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  label: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 },
  pinRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  findBtn: { height: 50, minWidth: 74, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  findText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 10 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.primary },
  actionText: { color: colors.primary, fontWeight: '700', fontSize: 13 },
  message: { fontSize: 12, color: colors.textSecondary, marginBottom: 10, lineHeight: 17 },
  messageError: { color: colors.danger },
  pinStatus: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 10, backgroundColor: '#F3F4F6', marginBottom: 14 },
  pinOk: { backgroundColor: '#ECFDF5' },
  pinBad: { backgroundColor: '#FEF2F2' },
  pinStatusText: { flex: 1, fontSize: 12, color: colors.text },
  modal: { flex: 1, backgroundColor: colors.background },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  modalHint: { fontSize: 13, color: colors.textSecondary, paddingHorizontal: 16, marginBottom: 10 },
  modalFooter: { padding: 16, gap: 10 },
  coords: { textAlign: 'center', fontSize: 13, color: colors.textSecondary },
  confirmBtn: { height: 52, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  confirmText: { color: '#FFFFFF', fontWeight: '800', fontSize: 16 },
});
