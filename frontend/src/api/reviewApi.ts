import { apiClient } from './client';

export interface Review {
  id: number;
  doctorId: number;
  doctorName: string;
  customerId: number;
  customerName: string;
  appointmentId?: number;
  rating: number;
  comment?: string;
  createdAt: string;
}

export const reviewApi = {
  async getDoctorReviews(doctorId: number, page = 0, size = 10) {
    const res = await apiClient.get<{
      success: boolean;
      data: {
        content: Review[];
        totalPages: number;
        totalElements: number;
      };
    }>(`/doctors/${doctorId}/reviews`, { params: { page, size } });
    return res.data;
  },

  async createReview(doctorId: number, payload: { appointmentId?: number; rating: number; comment?: string }) {
    const res = await apiClient.post<{ success: boolean; message: string; data: Review }>(
      `/doctors/${doctorId}/reviews`,
      payload
    );
    return res.data;
  },
};
