import { apiClient } from './client';
import { DoctorProfile } from './doctorApi';
import { Appointment } from './appointmentApi';
import type { Provider } from './careApi';

export interface AdminStats {
  totalCustomers: number;
  totalDoctors: number;
  pendingDoctorVerifications: number;
  resubmittedDoctorVerifications: number;
  pendingProviderVerifications: number;
  resubmittedProviderVerifications: number;
  totalPets: number;
  totalAppointments: number;
  completedAppointments: number;
  pendingAppointments: number;
  totalReviews: number;
}

export const adminApi = {
  async getDashboardStats() {
    const res = await apiClient.get<{ success: boolean; data: AdminStats }>('/admin/dashboard');
    return res.data;
  },

  async getPendingDoctors() {
    const res = await apiClient.get<{ success: boolean; data: DoctorProfile[] }>('/admin/doctors/pending');
    return res.data;
  },

  async getResubmittedDoctors() {
    const res = await apiClient.get<{ success: boolean; data: DoctorProfile[] }>('/admin/doctors/resubmitted');
    return res.data;
  },

  async updateDoctorVerification(doctorId: number, status: 'APPROVED' | 'REJECTED', remarks: string) {
    const res = await apiClient.patch<{ success: boolean; message: string; data: DoctorProfile }>(
      `/admin/doctors/${doctorId}/verification`,
      { status, remarks }
    );
    return res.data;
  },

  async getPendingProviders() {
    const res = await apiClient.get<{ success: boolean; data: Provider[] }>('/admin/providers/pending');
    return res.data;
  },

  async getResubmittedProviders() {
    const res = await apiClient.get<{ success: boolean; data: Provider[] }>('/admin/providers/resubmitted');
    return res.data;
  },

  async updateProviderVerification(providerId: number, status: 'APPROVED' | 'REJECTED', remarks: string) {
    const res = await apiClient.patch<{ success: boolean; message: string; data: Provider }>(
      `/admin/providers/${providerId}/verification`,
      { status, remarks }
    );
    return res.data;
  },

  async getAllAppointments(page = 0, size = 20) {
    const res = await apiClient.get<{
      success: boolean;
      data: {
        content: Appointment[];
        totalPages: number;
        totalElements: number;
      };
    }>('/admin/appointments', { params: { page, size } });
    return res.data;
  },
};
