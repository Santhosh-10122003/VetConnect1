import { apiClient } from './client';
import type { Appointment } from './appointmentApi';

export interface Specialization {
  id: number;
  name: string;
  description: string;
  iconName: string;
}

export interface DoctorAvailability {
  id?: number;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  slotDurationMinutes: number;
  breakStartTime?: string;
  breakEndTime?: string;
  isActive: boolean;
}

export type VerificationStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'RESUBMITTED';

export interface DoctorProfile {
  id: number;
  userId: number;
  email: string;
  phone?: string;
  fullName: string;
  licenseNumber: string;
  clinicName: string;
  clinicAddress: string;
  clinicCity: string;
  clinicPostalCode?: string;
  clinicState?: string;
  clinicCountry?: string;
  latitude?: number;
  longitude?: number;
  /** Distance from the signed-in customer, when both have GPS positions. */
  distanceKm?: number;
  yearsOfExperience: number;
  consultationFee: number;
  bio?: string;
  ratingAvg: number;
  reviewCount: number;
  verificationStatus: VerificationStatus;
  /** The admin's reason for the last decision; only returned to the doctor and to admins. */
  verificationReason?: string;
  reviewedAt?: string;
  resubmittedAt?: string;
  resubmitNote?: string;
  avatarUrl?: string;
  specializations: Specialization[];
  availabilities: DoctorAvailability[];
}

export interface AvailableSlot {
  date: string;
  startTime: string;
  endTime: string;
  available: boolean;
}

export const doctorApi = {
  async searchDoctors(params?: {
    query?: string;
    specializationId?: number;
    maxFee?: number;
    minRating?: number;
    radiusKm?: number;
    page?: number;
    size?: number;
  }) {
    const res = await apiClient.get<{
      success: boolean;
      data: {
        content: DoctorProfile[];
        totalPages: number;
        totalElements: number;
      };
    }>('/doctors', { params });
    return res.data;
  },

  async getDoctorById(doctorId: number) {
    const res = await apiClient.get<{ success: boolean; data: DoctorProfile }>(`/doctors/${doctorId}`);
    return res.data;
  },

  async getDoctorAvailability(doctorId: number, date: string) {
    const res = await apiClient.get<{ success: boolean; data: AvailableSlot[] }>(`/doctors/${doctorId}/availability`, {
      params: { date },
    });
    return res.data;
  },

  async getMyDoctorProfile() {
    const res = await apiClient.get<{ success: boolean; data: DoctorProfile }>('/doctors/profile/me');
    return res.data;
  },

  async updateDoctorProfile(payload: Partial<DoctorProfile>) {
    const res = await apiClient.put<{ success: boolean; data: DoctorProfile }>('/doctors/profile', payload);
    return res.data;
  },

  async updateAvailability(payload: { availabilities: DoctorAvailability[] }) {
    const res = await apiClient.put<{ success: boolean; data: DoctorProfile }>('/doctors/availability', payload);
    return res.data;
  },

  async resubmitForApproval(note?: string) {
    const res = await apiClient.post<{ success: boolean; message: string; data: DoctorProfile }>('/doctors/profile/resubmit', { note });
    return res.data;
  },

  async getDoctorAppointments(status?: string, page = 0, size = 100) {
    const res = await apiClient.get<{
      success: boolean;
      data: {
        content: Appointment[];
        totalPages: number;
        totalElements: number;
      };
    }>('/doctors/appointments', { params: { status, page, size } });
    return res.data;
  },

  async getSpecializations() {
    const res = await apiClient.get<{ success: boolean; data: Specialization[] }>('/specializations');
    return res.data;
  },
};
