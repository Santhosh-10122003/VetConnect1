import { Linking, Platform } from 'react-native';

interface Destination {
  latitude?: number | null;
  longitude?: number | null;
  /** Used as the label, and as a search when there are no coordinates. */
  name?: string;
  address?: string;
}

/** The universal web link (opens Google Maps, or the browser, on any device). */
export const directionsWebUrl = (d: Destination): string => {
  if (d.latitude != null && d.longitude != null) {
    return `https://www.google.com/maps/dir/?api=1&destination=${d.latitude},${d.longitude}`;
  }
  const query = encodeURIComponent([d.name, d.address].filter(Boolean).join(', '));
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
};

/** Opens turn-by-turn navigation to the clinic in the phone's maps app. */
export const openDirections = async (d: Destination): Promise<void> => {
  const web = directionsWebUrl(d);
  if (Platform.OS === 'web') {
    window.open(web, '_blank', 'noopener');
    return;
  }
  const hasPin = d.latitude != null && d.longitude != null;
  const label = encodeURIComponent(d.name || 'Clinic');
  // iOS: Apple Maps. Android: any installed maps app via a geo: link. Both fall back to the web link.
  const native = hasPin
    ? Platform.OS === 'ios'
      ? `http://maps.apple.com/?daddr=${d.latitude},${d.longitude}&q=${label}&dirflg=d`
      : `geo:${d.latitude},${d.longitude}?q=${d.latitude},${d.longitude}(${label})`
    : null;
  try {
    // No canOpenURL pre-check: it needs extra manifest entries on Android 11+, and failing is cheap here.
    if (native) {
      await Linking.openURL(native);
      return;
    }
  } catch {
    /* no maps app handles it: fall through to the web link */
  }
  await Linking.openURL(web);
};
