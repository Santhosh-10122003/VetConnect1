import { apiClient } from './client';

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

  async deletePet(petId: number) {
    const res = await apiClient.delete<{ success: boolean; message: string }>(`/pets/${petId}`);
    return res.data;
  },
};
