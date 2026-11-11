import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, SafeAreaView, ActivityIndicator, Linking, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { colors } from '../../theme/colors';
import { AppInput } from './AppInput';
import { SelectField, SelectOption } from './SelectField';
import { OsmMap } from './OsmMap';
import { geoApi, Country, GeoPlace, StateItem } from '../../api/geoApi';
import { confirmAction, getErrorMessage } from '../../utils/helpers';
import { themedStyles } from '../../theme/themed';

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
  /** The person looked at the pin on the map and confirmed it is the exact spot (clinics and businesses). */
  pinConfirmed?: boolean;
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
  /** Put the map and the current-location button first, with the address boxes below them. */
  mapFirst?: boolean;
  /** The country to start on when none is chosen yet (by name). */
  defaultCountry?: string;
  /** Do not ask for the country at all (the app serves one country): it is simply set to {@link defaultCountry}. */
  hideCountry?: boolean;
}

const sameName = (a?: string, b?: string) => (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase();

/**
 * Where a person or a clinic is: pick country, state and district from dropdowns, or type a postal code,
 * or use GPS, or drop a pin on the map. Whatever is chosen fills in the rest.
 */
export const LocationPicker: React.FC<Props> = ({ value, onChange, pinRequired, districtLabel = 'District / City *', errors, mapFirst, defaultCountry, hideCountry }) => {
  const [countries, setCountries] = useState<Country[]>([]);
  const [states, setStates] = useState<StateItem[]>([]);
  const [districts, setDistricts] = useState<string[]>([]);
  const [loadingLists, setLoadingLists] = useState({ countries: true, states: false, districts: false });
  const [busy, setBusy] = useState<'postal' | 'gps' | null>(null);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [mapOpen, setMapOpen] = useState(false);
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number; zoom?: number } | null>(null);

  // Always read the latest value when several async results arrive close together.
  const latest = useRef(value);
  latest.current = value;
  const emit = (patch: Partial<LocationValue>) => {
    // a new or removed pin has to be looked at and confirmed again
    const movedPin = ('latitude' in patch || 'longitude' in patch) && !('pinConfirmed' in patch);
    latest.current = { ...latest.current, ...patch, ...(movedPin ? { pinConfirmed: false } : {}) };
    onChange(latest.current);
  };

  // ---- lists
  useEffect(() => {
    geoApi.countries().then(setCountries).catch(() => setMessage({ text: 'Could not load the country list.', error: true }))
      .finally(() => setLoadingLists((l) => ({ ...l, countries: false })));
  }, []);

  // Nothing chosen yet: start on the default country, so only the state and district are left to pick.
  useEffect(() => {
    if (defaultCountry && countries.length && !latest.current.country && !latest.current.countryCode) {
      const c = countries.find((x) => sameName(x.name, defaultCountry));
      if (c) emit({ countryCode: c.code, country: c.name });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countries, defaultCountry]);

  // With no pin yet, the map looks at the chosen district (or state) instead of the whole world.
  useEffect(() => {
    if (!mapFirst || value.latitude != null) return;
    if (!value.countryCode || !(value.city || value.state)) { setMapCenter(null); return; }
    let off = false;
    geoApi.place(value.countryCode, value.state ?? '', value.city ?? '')
      .then((p) => { if (!off && p.latitude != null && p.longitude != null) setMapCenter({ lat: p.latitude, lng: p.longitude, zoom: value.city ? 12 : 7 }); })
      .catch(() => {});
    return () => { off = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapFirst, value.countryCode, value.state, value.city, value.latitude]);

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

  /** The phone's location is switched off, or Jenni may not use it: say so in a pop-up with a way to fix it. */
  const askToTurnOnLocation = async (switchedOff: boolean) => {
    const go = await confirmAction(
      switchedOff ? 'Turn on location' : 'Allow location',
      switchedOff
        ? 'Location is switched off on your phone. Turn it on, then press "Use my current location" again.'
        : 'Jenni needs permission to use your location. Allow it in your phone settings, then try again.',
      Platform.OS === 'web' ? 'OK' : 'Open settings'
    );
    if (go && Platform.OS !== 'web') {
      try {
        if (Platform.OS === 'android' && switchedOff) await Linking.sendIntent('android.settings.LOCATION_SOURCE_SETTINGS');
        else await Linking.openSettings();
      } catch {
        // nothing more to do: the message below tells them what to do by hand
      }
    }
    setMessage({ text: switchedOff ? 'Location is off. Turn it on in your phone, or choose your place from the map and the lists.' : 'Location is not allowed. Choose your place from the map and the lists, or allow it in settings.', error: true });
  };

  /** Asks the phone where it is. Handles "location is off" and "not allowed" itself, and returns null in those cases. */
  const getGpsFix = async (): Promise<{ lat: number; lng: number } | null> => {
    try {
      // 1. is the phone's location switched on at all?
      let on = true;
      try { on = await Location.hasServicesEnabledAsync(); } catch { on = true; }
      if (!on && Platform.OS === 'android') {
        // Android can show its own "turn on location" box right here
        try { await Location.enableNetworkProviderAsync(); on = await Location.hasServicesEnabledAsync(); } catch { on = false; }
      }
      if (!on) { await askToTurnOnLocation(true); return null; }

      // 2. may Jenni use it?
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') {
        await askToTurnOnLocation(false);
        return null;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      return { lat: Number(pos.coords.latitude.toFixed(6)), lng: Number(pos.coords.longitude.toFixed(6)) };
    } catch (e) {
      // the phone refused to give a position (for example, location switched off while we were asking)
      const m = String((e as { message?: string })?.message ?? '');
      if (/unsatisfied device settings|location services|disabled|unavailable|provider/i.test(m)) await askToTurnOnLocation(true);
      else setMessage({ text: getErrorMessage(e, 'Could not get your location.'), error: true });
      return null;
    }
  };

  const useMyLocation = async () => {
    setBusy('gps');
    setMessage(null);
    try {
      const exact = await getGpsFix();
      if (!exact) return;
      try {
        applyPlace(await geoApi.reverse(exact.lat, exact.lng), exact);
        setMessage({ text: 'Location set from GPS. You can fine-tune it on the map.' });
      } catch {
        emit({ latitude: exact.lat, longitude: exact.lng });
        setMessage({ text: 'Your position is saved. Please choose the district from the list.' });
      }
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

  // map and "use my current location" come first, the address boxes below them
  const mapBlock = mapFirst ? (
    <View style={styles.mapBlock}>
      <OsmMap interactive latitude={value.latitude} longitude={value.longitude} center={mapCenter} height={250} zoom={14} onPick={(lat, lng) => { onMapConfirm(lat, lng); }} />
      <Text style={styles.mapHint}>{hasPin ? 'Drag the pin or tap the map to move it.' : 'Tap the map to drop a pin.'}</Text>
      <TouchableOpacity style={styles.gpsWide} onPress={useMyLocation} disabled={busy !== null} activeOpacity={0.85} testID="loc-gps">
        {busy === 'gps' ? <ActivityIndicator size="small" color={colors.primary} /> : <Ionicons name="navigate" size={18} color={colors.primary} />}
        <Text style={styles.gpsWideText}>Use my current location</Text>
      </TouchableOpacity>
      <Text style={styles.orAddress}>or choose the address</Text>
    </View>
  ) : null;

  return (
    <View>
      {mapBlock}
      {!hideCountry && <SelectField
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
      />}
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

      {!mapFirst && <View style={styles.actions}>
        <TouchableOpacity style={styles.actionBtn} onPress={() => setMapOpen(true)} testID="loc-map" accessibilityLabel="Set location on the map">
          <Ionicons name={hasPin ? 'location' : 'location-outline'} size={22} color={colors.primary} />
          <Text style={styles.actionText}>{hasPin ? 'Change location on map' : 'Set location on map'}</Text>
        </TouchableOpacity>
      </View>}

      {message ? <Text style={[styles.message, message.error && styles.messageError]}>{message.text}</Text> : null}

      {!mapFirst && <View style={[styles.pinStatus, hasPin ? styles.pinOk : (pinRequired && errors?.pin) ? styles.pinBad : null]}>
        <Ionicons
          name={hasPin ? 'checkmark-circle' : 'pin-outline'}
          size={18}
          color={hasPin ? colors.success : errors?.pin ? colors.danger : colors.textMuted}
        />
        <Text style={styles.pinStatusText} testID="loc-pin-status">
          {hasPin
            ? (pinRequired && !value.pinConfirmed ? 'Pinned. Check the map below, then tick the box to confirm.' : `Pinned at ${value.latitude!.toFixed(5)}, ${value.longitude!.toFixed(5)}`)
            : pinRequired
              ? errors?.pin || 'Pin your clinic on the map so pet owners can navigate to you.'
              : 'No map pin yet (optional): add one to see distances to clinics.'}
        </Text>
      </View>}

      {!mapFirst && pinRequired && hasPin && (
        <View style={styles.preview} testID="loc-pin-preview">
          <OsmMap latitude={value.latitude} longitude={value.longitude} height={190} zoom={17} />
          <TouchableOpacity
            style={[styles.confirmRow, errors?.pin && !value.pinConfirmed && styles.confirmRowBad]}
            onPress={() => emit({ pinConfirmed: !value.pinConfirmed })}
            activeOpacity={0.85}
            testID="loc-pin-confirm"
            accessibilityRole="checkbox"
            accessibilityState={{ checked: !!value.pinConfirmed }}
          >
            <Ionicons name={value.pinConfirmed ? 'checkbox' : 'square-outline'} size={24} color={value.pinConfirmed ? colors.success : colors.textSecondary} />
            <Text style={styles.confirmRowText}>I have checked the map. This pin is my exact location.</Text>
          </TouchableOpacity>
        </View>
      )}

      <MapPickerModal
        visible={mapOpen}
        initialLat={value.latitude}
        initialLng={value.longitude}
        countryCode={value.countryCode}
        state={value.state}
        district={value.city}
        onClose={() => setMapOpen(false)}
        onConfirm={onMapConfirm}
        getGpsFix={getGpsFix}
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
  getGpsFix: () => Promise<{ lat: number; lng: number } | null>;
}> = ({ visible, initialLat, initialLng, countryCode, state, district, onClose, onConfirm, getGpsFix }) => {
  const [pick, setPick] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const useGps = async () => {
    setLocating(true);
    try {
      const fix = await getGpsFix();
      if (fix) setPick(fix); // the map moves its marker to the new pin
    } finally {
      setLocating(false);
    }
  };
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
        <Text style={styles.modalHint}>Tap the map to drop the pin, or drag it. Zoom in for accuracy.</Text>
        <TouchableOpacity style={styles.modalGps} onPress={useGps} disabled={locating} activeOpacity={0.85} testID="map-gps">
          {locating ? <ActivityIndicator size="small" color={colors.primary} /> : <Ionicons name="navigate" size={16} color={colors.primary} />}
          <Text style={styles.modalGpsText}>Use my current location</Text>
        </TouchableOpacity>
        <View style={{ flex: 1, paddingHorizontal: 12 }}>
          {visible && !ready && <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />}
          {visible && ready && (
            <OsmMap
              interactive
              latitude={pick?.lat ?? initialLat}
              longitude={pick?.lng ?? initialLng}
              fill
              center={center ?? (!countryCode || countryCode === 'IN' ? { lat: 22.5, lng: 79, zoom: 4 } : null)}
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

const styles = themedStyles(() => ({
  mapBlock: { marginBottom: 6 },
  mapHint: { fontSize: 12, color: colors.textMuted, textAlign: 'center', marginTop: 8 },
  gpsWide: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 12, paddingVertical: 14, borderRadius: 16, backgroundColor: colors.mint },
  gpsWideText: { color: colors.ink, fontWeight: '800', fontSize: 15 },
  orAddress: { fontSize: 12, fontWeight: '800', color: colors.textSecondary, textAlign: 'center', marginTop: 16, marginBottom: 12 },
  label: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 },
  pinRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  findBtn: { height: 50, minWidth: 74, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  findText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 10 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.primary },
  actionText: { color: colors.ink, fontWeight: '700', fontSize: 13 },
  message: { fontSize: 12, color: colors.textSecondary, marginBottom: 10, lineHeight: 17 },
  messageError: { color: colors.danger },
  pinStatus: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 10, backgroundColor: colors.subtle, marginBottom: 14 },
  pinOk: { backgroundColor: colors.successBg },
  pinBad: { backgroundColor: colors.dangerBg },
  pinStatusText: { flex: 1, fontSize: 12, color: colors.text },
  modal: { flex: 1, backgroundColor: colors.page },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  modalHint: { fontSize: 13, color: colors.textSecondary, paddingHorizontal: 16, marginBottom: 10 },
  preview: { marginBottom: 14, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  confirmRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  confirmRowBad: { backgroundColor: colors.dangerBg },
  confirmRowText: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.text },
  modalGps: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6, marginHorizontal: 16, marginBottom: 10, paddingVertical: 7, paddingHorizontal: 12, borderRadius: 16, backgroundColor: colors.mint },
  modalGpsText: { color: colors.ink, fontWeight: '700', fontSize: 12 },
  modalFooter: { padding: 16, gap: 10 },
  coords: { textAlign: 'center', fontSize: 13, color: colors.textSecondary },
  confirmBtn: { height: 52, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  confirmText: { color: '#FFFFFF', fontWeight: '800', fontSize: 16 },
}));
