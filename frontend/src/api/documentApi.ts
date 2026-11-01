import { Linking, Platform } from 'react-native';
import { apiClient, API_URL } from './client';

export type DocumentType = 'DEGREE' | 'REGISTRATION_CERTIFICATE' | 'TRADE_LICENCE' | 'ID_PROOF' | 'OTHER';

export interface VerificationDocument {
  id: number;
  type: DocumentType;
  name: string;
  contentType: string;
  sizeBytes: number;
  uploadedAt: string;
}

/** What the picker hands back (the web gives a File, a phone gives a uri). */
export interface PickedFile {
  uri: string;
  name: string;
  mimeType?: string;
  file?: File;
}

export const DOCUMENT_LABEL: Record<DocumentType, string> = {
  DEGREE: 'Degree certificate',
  REGISTRATION_CERTIFICATE: 'Registration certificate',
  TRADE_LICENCE: 'Trade licence',
  ID_PROOF: 'ID proof',
  OTHER: 'Other',
};

export const documentApi = {
  async mine() {
    const res = await apiClient.get<{ success: boolean; data: VerificationDocument[] }>('/documents');
    return res.data.data;
  },

  async forOwner(ownerType: 'DOCTOR' | 'PROVIDER', ownerId: number) {
    const res = await apiClient.get<{ success: boolean; data: VerificationDocument[] }>(`/admin/documents/${ownerType}/${ownerId}`);
    return res.data.data;
  },

  async upload(type: DocumentType, picked: PickedFile) {
    const form = new FormData();
    form.append('type', type);
    if (Platform.OS === 'web' && picked.file) {
      form.append('file', picked.file);
    } else {
      form.append('file', { uri: picked.uri, name: picked.name, type: picked.mimeType || 'application/octet-stream' } as unknown as Blob);
    }
    const res = await apiClient.post<{ success: boolean; data: VerificationDocument }>('/documents', form, {
      // the browser must set the multipart boundary itself; a phone needs the type spelled out
      headers: { 'Content-Type': Platform.OS === 'web' ? undefined : 'multipart/form-data' } as Record<string, string>,
      timeout: 60000,
    });
    return res.data.data;
  },

  async remove(id: number) {
    await apiClient.delete(`/documents/${id}`);
  },

  /** Opens the document in the browser or the phone's viewer through a short-lived link. */
  async open(id: number) {
    // a browser only lets a tab open straight after a tap, so claim it before waiting for the link
    const tab = Platform.OS === 'web' && typeof window !== 'undefined' ? window.open('', '_blank') : null;
    try {
      const res = await apiClient.get<{ success: boolean; data: { path: string } }>(`/documents/${id}/link`);
      const url = API_URL + res.data.data.path;
      if (tab) tab.location.href = url;
      else await Linking.openURL(url);
    } catch (e) {
      if (tab) tab.close();
      throw e;
    }
  },
};
