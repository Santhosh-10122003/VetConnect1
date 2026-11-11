import { useSyncExternalStore } from 'react';
import * as Linking from 'expo-linking';
import { API_URL } from '../api/client';

const PATH = 'find-pet';

/**
 * What a pet's QR code holds: a link that opens this app on the pet's owner details. It carries only the pet's number,
 * never the owner's details (those are fetched when the link is opened).
 */
export const petLink = (number: string): string => `${process.env.EXPO_PUBLIC_PET_LINK_BASE || API_URL}/p/${number}`;

/** The pet number inside a scanned link, or null if the link is something else. */
export const petNumberFromUrl = (url: string | null | undefined): string | null => {
  if (!url) return null;
  try {
    const parsed = Linking.parse(url);
    const path = (parsed.path ?? '').replace(/^\/+/, '');
    // the address on the QR code (.../p/<number>) when a phone hands it to the app
    const onPage = /(?:^|\/)p\/(\d{15})$/.exec(path);
    if (onPage) return onPage[1];
    // the app's own link (jenni://find-pet?number=...)
    const n = parsed.queryParams?.number;
    const value = Array.isArray(n) ? n[0] : n;
    return path.endsWith(PATH) && typeof value === 'string' && /^\d{15}$/.test(value) ? value : null;
  } catch {
    return null;
  }
};

/** The pet number in whatever a camera read from a code: the page address, the app link, or the 15 digits themselves. */
export const petNumberFromScan = (data: string | null | undefined): string | null => {
  const text = (data ?? '').trim();
  if (/^d{15}$/.test(text)) return text;
  return petNumberFromUrl(text);
};

// ---- a scanned pet: shown on its own, in front of everything, with or without a sign-in
let scanned: string | null = null;
let everScanned = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const showScannedPet = (n: string) => { scanned = n; everScanned = true; emit(); };
export const closeScannedPet = () => { scanned = null; emit(); };
export const useScannedPet = (): string | null =>
  useSyncExternalStore((cb) => { listeners.add(cb); return () => { listeners.delete(cb); }; }, () => scanned, () => scanned);

/** A pet QR code opened the app this time: the guided tour should not jump in on top of it. */
export const wasScanned = () => everScanned;
