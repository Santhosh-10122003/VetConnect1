import { apiClient } from './client';

export interface CustomerProfile {
  id: number;
  userId: number;
  email: string;
  phone?: string;
  fullName: string;
  address?: string;
  city?: string;
  postalCode?: string;
  state?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  emergencyContact?: string;
  avatarUrl?: string;
  createdAt: string;
}

export const customerApi = {
  async getMyProfile() {
    const res = await apiClient.get<{ success: boolean; data: CustomerProfile }>('/customers/me');
    return res.data;
  },

  async updateMyProfile(payload: Partial<CustomerProfile>) {
    const res = await apiClient.put<{ success: boolean; data: CustomerProfile }>('/customers/me', payload);
    return res.data;
  },
};
