import { apiClient } from './client';

export interface Country {
  code: string;
  name: string;
  dialCode?: string;
}

export interface StateItem {
  code: string;
  name: string;
}

/** A place resolved from a postal code or a map pin. */
export interface GeoPlace {
  latitude?: number;
  longitude?: number;
  countryCode?: string;
  country?: string;
  stateCode?: string;
  state?: string;
  district?: string;
  postalCode?: string;
  displayName?: string;
}

type Wrapped<T> = { success: boolean; data: T };

// The lists never change while the app runs, so keep them for the session.
const cache = new Map<string, unknown>();
async function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  if (!cache.has(key)) cache.set(key, await load());
  return cache.get(key) as T;
}

export const geoApi = {
  countries: () =>
    cached('countries', async () => (await apiClient.get<Wrapped<Country[]>>('/geo/countries')).data.data),

  states: (countryCode: string) =>
    cached(`states:${countryCode}`, async () =>
      (await apiClient.get<Wrapped<StateItem[]>>(`/geo/countries/${countryCode}/states`)).data.data),

  districts: (countryCode: string, stateCode: string) =>
    cached(`districts:${countryCode}:${stateCode}`, async () =>
      (await apiClient.get<Wrapped<string[]>>(`/geo/countries/${countryCode}/states/${stateCode}/districts`)).data.data),

  async postalCode(countryCode: string, code: string) {
    const res = await apiClient.get<Wrapped<GeoPlace>>('/geo/postal-code', { params: { country: countryCode, code } });
    return res.data.data;
  },

  /** The middle of a district, so a map can open there. */
  async place(countryCode: string, state: string, district: string) {
    const res = await apiClient.get<Wrapped<GeoPlace>>('/geo/place', { params: { country: countryCode, state, district } });
    return res.data.data;
  },

  async reverse(lat: number, lng: number) {
    const res = await apiClient.get<Wrapped<GeoPlace>>('/geo/reverse', { params: { lat, lng } });
    return res.data.data;
  },
};
