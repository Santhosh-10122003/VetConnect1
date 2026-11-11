import { Platform } from 'react-native';
import axios from 'axios';
import { apiClient, API_URL } from './client';
import type { PickedFile } from './documentApi';

/** A pet's photo is kept as /pet-photos/<name>; this is the address the app can show. */
export const photoUri = (avatarUrl?: string | null): string | undefined =>
  !avatarUrl ? undefined : avatarUrl.startsWith('/') ? API_URL + avatarUrl : avatarUrl;

export interface Pet {
  id: number;
  customerId: number;
  customerName: string;
  name: string;
  species: 'DOG' | 'CAT' | 'BIRD' | 'RABBIT' | 'OTHER';
  breed?: string;
  dateOfBirth?: string;
  gender: 'MALE' | 'FEMALE' | 'UNKNOWN';
  weight?: number;
  allergies?: string;
  existingConditions?: string;
  microchipNumber?: string;
  avatarUrl?: string;
  createdAt: string;
}

export interface PetOwnerInfo {
  petName: string;
  species?: string;
  breed?: string;
  avatarUrl?: string;
  ownerName: string;
  ownerPhone?: string;
  ownerAddress?: string;
}

/** 999123456789012 shown as 999 123 456 789 012, so it is easy to read out and type. */
export const formatPetId = (n?: string | null) => (n ? n.replace(/(\d{3})(?=\d)/g, '$1 ') : '');

export interface CreatePetPayload {
  name: string;
  species: string;
  breed?: string;
  dateOfBirth?: string;
  gender: string;
  weight?: number;
  allergies?: string;
  existingConditions?: string;
  microchipNumber?: string;
  avatarUrl?: string;
}

export const petApi = {
  async getMyPets() {
    const res = await apiClient.get<{ success: boolean; data: Pet[] }>('/pets');
    return res.data;
  },

  async getPetById(petId: number) {
    const res = await apiClient.get<{ success: boolean; data: Pet }>(`/pets/${petId}`);
    return res.data;
  },

  async createPet(payload: CreatePetPayload) {
    const res = await apiClient.post<{ success: boolean; message: string; data: Pet }>('/pets', payload);
    return res.data;
  },

  async updatePet(petId: number, payload: Partial<CreatePetPayload>) {
    const res = await apiClient.put<{ success: boolean; message: string; data: Pet }>(`/pets/${petId}`, payload);
    return res.data;
  },

  /** Sets the pet's profile photo (JPG or PNG). */
  async uploadPhoto(petId: number, picked: PickedFile) {
    const form = new FormData();
    if (Platform.OS === 'web' && picked.file) form.append('file', picked.file);
    else form.append('file', { uri: picked.uri, name: picked.name, type: picked.mimeType || 'image/jpeg' } as unknown as Blob);
    const res = await apiClient.post<{ success: boolean; data: Pet }>(`/pets/${petId}/photo`, form, {
      headers: { 'Content-Type': Platform.OS === 'web' ? undefined : 'multipart/form-data' } as Record<string, string>,
      timeout: 60000,
    });
    return res.data.data;
  },

  async removePhoto(petId: number) {
    const res = await apiClient.delete<{ success: boolean; data: Pet }>(`/pets/${petId}/photo`);
    return res.data.data;
  },

  /** A scanned QR code: the owner's details without any sign-in. */
  async scan(number: string) {
    const res = await axios.get<{ success: boolean; data: PetOwnerInfo }>(`${API_URL}/pet-finder/${number}`, { timeout: 15000 });
    return res.data.data;
  },

  /** Found a pet? Its ID number gives the owner's name, mobile number and address. */
  async findOwner(number: string) {
    const res = await apiClient.get<{ success: boolean; data: PetOwnerInfo }>('/pets/lookup', { params: { number } });
    return res.data.data;
  },

  async deletePet(petId: number) {
    const res = await apiClient.delete<{ success: boolean; message: string }>(`/pets/${petId}`);
    return res.data;
  },
};
