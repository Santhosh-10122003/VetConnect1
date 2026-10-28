import { apiClient } from './client';
import type { CarePayment, CancellationPreview, CheckoutResult } from './careApi';

export type AppointmentStatus = 'AWAITING_PAYMENT' | 'PENDING' | 'CONFIRMED' | 'REJECTED' | 'CANCELLED' | 'COMPLETED' | 'NO_SHOW' | 'EXPIRED';

export interface Appointment {
  id: number;
  bookingReference: string;
  customerId: number;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  doctorId: number;
  doctorName: string;
  clinicName: string;
  clinicAddress: string;
  clinicCity?: string;
  clinicLatitude?: number | null;
  clinicLongitude?: number | null;
  consultationFee: number;
  /** The visit's cost, the advance paid up front, and what is left to pay at the clinic. */
  totalAmount: number;
  advanceAmount: number;
  balanceAmount: number;
  currency?: string;
  /** While waiting for the advance: when the held slot is released. */
  expiresAt?: string | null;
  payment?: CarePayment | null;
  /** The reschedule the owner asked for, waiting for the doctor's answer. */
  rescheduleRequest?: { appointmentDate: string; startTime: string; endTime: string; note?: string; requestedAt?: string } | null;
  petId: number;
  petName: string;
  petSpecies: string;
  petBreed?: string;
  appointmentDate: string;
  startTime: string;
  endTime: string;
  reason: string;
  status: AppointmentStatus;
  cancellationReason?: string;
  notes?: string;
  hasReview: boolean;
  createdAt: string;
}

export interface BookAppointmentPayload {
  doctorId: number;
  petId: number;
  appointmentDate: string;
  startTime: string;
  endTime: string;
  reason: string;
  notes?: string;
}

export const appointmentApi = {
  async bookAppointment(payload: BookAppointmentPayload) {
    const res = await apiClient.post<{ success: boolean; message: string; data: Appointment }>('/appointments', payload);
    return res.data;
  },

  async simulatePayment(id: number, outcome: 'SUCCESS' | 'FAILURE') {
    const res = await apiClient.post<{ success: boolean; data: Appointment }>(`/appointments/${id}/payment/simulate`, { outcome });
    return res.data.data;
  },

  async confirmPayment(id: number, result: CheckoutResult) {
    const res = await apiClient.post<{ success: boolean; data: Appointment }>(`/appointments/${id}/payment/confirm`, result);
    return res.data.data;
  },

  async paymentFailed(id: number, reason?: string) {
    const res = await apiClient.post<{ success: boolean; data: Appointment }>(`/appointments/${id}/payment/failed`, { reason });
    return res.data.data;
  },

  async retryPayment(id: number) {
    const res = await apiClient.post<{ success: boolean; data: Appointment }>(`/appointments/${id}/payment/retry`);
    return res.data.data;
  },

  async cancellationPreview(id: number) {
    const res = await apiClient.get<{ success: boolean; data: CancellationPreview }>(`/appointments/${id}/cancellation-preview`);
    return res.data.data;
  },

  async getMyAppointments(tab?: string, page = 0, size = 20) {
    const res = await apiClient.get<{
      success: boolean;
      data: {
        content: Appointment[];
        totalPages: number;
        totalElements: number;
      };
    }>('/appointments/my', {
      params: { tab, page, size },
    });
    return res.data;
  },

  async getAppointmentById(appointmentId: number) {
    const res = await apiClient.get<{ success: boolean; data: Appointment }>(`/appointments/${appointmentId}`);
    return res.data;
  },

  async confirmAppointment(appointmentId: number, notes?: string) {
    const res = await apiClient.patch<{ success: boolean; message: string; data: Appointment }>(
      `/appointments/${appointmentId}/confirm`,
      { notes }
    );
    return res.data;
  },

  async rejectAppointment(appointmentId: number, reason: string) {
    const res = await apiClient.patch<{ success: boolean; message: string; data: Appointment }>(
      `/appointments/${appointmentId}/reject`,
      { reason }
    );
    return res.data;
  },

  async cancelAppointment(appointmentId: number, reason: string) {
    const res = await apiClient.patch<{ success: boolean; message: string; data: Appointment }>(
      `/appointments/${appointmentId}/cancel`,
      { reason }
    );
    return res.data;
  },

  async completeAppointment(appointmentId: number, notes?: string) {
    const res = await apiClient.patch<{ success: boolean; message: string; data: Appointment }>(
      `/appointments/${appointmentId}/complete`,
      { notes }
    );
    return res.data;
  },

  async approveReschedule(appointmentId: number) {
    const res = await apiClient.patch<{ success: boolean; data: Appointment }>(`/appointments/${appointmentId}/reschedule/approve`);
    return res.data.data;
  },

  async rejectReschedule(appointmentId: number, reason: string) {
    const res = await apiClient.patch<{ success: boolean; data: Appointment }>(`/appointments/${appointmentId}/reschedule/reject`, { reason });
    return res.data.data;
  },

  async withdrawReschedule(appointmentId: number) {
    const res = await apiClient.patch<{ success: boolean; data: Appointment }>(`/appointments/${appointmentId}/reschedule/withdraw`);
    return res.data.data;
  },

  async rescheduleAppointment(appointmentId: number, payload: { appointmentDate: string; startTime: string; endTime: string; note?: string }) {
    const res = await apiClient.patch<{ success: boolean; message: string; data: Appointment }>(
      `/appointments/${appointmentId}/reschedule`,
      payload
    );
    return res.data;
  },
};
