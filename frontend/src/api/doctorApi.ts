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

export type SlotStatus = 'AVAILABLE' | 'BOOKED' | 'BLOCKED' | 'BREAK' | 'PAST';

export interface ScheduleSlot {
  date: string;
  startTime: string;
  endTime: string;
  status: SlotStatus;
  /** For slots the doctor marked as booked: what to send to undo it. */
  blockId?: number | null;
  reason?: string | null;
  /** Who the doctor booked a blocked slot for. */
  blockedForName?: string | null;
  blockedForPhone?: string | null;
  // for slots held by a customer
  appointmentId?: number | null;
  reference?: string | null;
  petName?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  appointmentStatus?: string | null;
  note?: string | null;
  canBlock: boolean;
  canUnblock: boolean;
}

export interface DoctorProfile {
  /** Where the doctor is paid (owner view; the account number is masked). */
  payoutMethod?: 'UPI' | 'BANK' | null;
  upiId?: string | null;
  accountHolderName?: string | null;
  bankAccountMasked?: string | null;
  ifscCode?: string | null;
  bankName?: string | null;
  payoutComplete?: boolean;
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

  /** The doctor's own view of a day: every slot with what is on it. */
  async getMySchedule(date: string) {
    const res = await apiClient.get<{ success: boolean; data: ScheduleSlot[] }>('/doctors/me/schedule', { params: { date } });
    return res.data.data;
  },

  async blockSlot(date: string, startTime: string, who?: { customerName?: string; customerPhone?: string }, reason?: string) {
    const res = await apiClient.post<{ success: boolean; data: ScheduleSlot }>('/doctors/me/blocked-slots', { date, startTime, reason, ...who });
    return res.data.data;
  },

  async unblockSlot(blockId: number) {
    await apiClient.delete(`/doctors/me/blocked-slots/${blockId}`);
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
