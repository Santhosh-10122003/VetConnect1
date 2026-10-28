import { apiClient } from './client';

export interface RegisterPayload {
  email: string;
  password: string;
  confirmPassword?: string;
  phone?: string;
  role: 'ROLE_CUSTOMER' | 'ROLE_DOCTOR' | 'ROLE_PROVIDER';
  fullName: string;
  licenseNumber?: string;
  clinicName?: string;
  clinicAddress?: string;
  yearsOfExperience?: number;
  consultationFee?: number;
  bio?: string;
  specializationIds?: number[];
  address?: string;
  city?: string;
  postalCode?: string;
  state?: string;
  country?: string;
  emergencyContact?: string;
  businessName?: string;
  description?: string;
  categories?: ('GROOMING' | 'BOARDING' | 'TRAINING')[];
  clinicCity?: string;
  clinicPostalCode?: string;
  latitude?: number;
  longitude?: number;
}

/** Sign-up creates an unverified account; the user must confirm the emailed code before logging in. */
export interface RegistrationResult {
  email: string;
  verificationRequired: boolean;
  otpExpiresInMinutes: number;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface AuthResponseData {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  userId: number;
  email: string;
  role: 'ROLE_CUSTOMER' | 'ROLE_DOCTOR' | 'ROLE_PROVIDER' | 'ROLE_ADMIN';
  fullName: string;
  profileId: number;
  verificationStatus?: 'PENDING' | 'APPROVED' | 'REJECTED';
}

export const authApi = {
  async register(payload: RegisterPayload) {
    const res = await apiClient.post<{ success: boolean; message: string; data: RegistrationResult }>('/auth/register', payload);
    return res.data;
  },

  async verifyOtp(email: string, otp: string) {
    const res = await apiClient.post<{ success: boolean; message: string; data: AuthResponseData }>('/auth/verify-otp', { email, otp });
    return res.data;
  },

  async resendOtp(email: string) {
    const res = await apiClient.post<{ success: boolean; message: string }>('/auth/resend-otp', { email });
    return res.data;
  },

  async login(payload: LoginPayload) {
    const res = await apiClient.post<{ success: boolean; message: string; data: AuthResponseData }>('/auth/login', payload);
    return res.data;
  },

  async logout() {
    const res = await apiClient.post<{ success: boolean; message: string }>('/auth/logout');
    return res.data;
  },

  async forgotPassword(email: string) {
    const res = await apiClient.post<{ success: boolean; message: string }>('/auth/forgot-password', { email });
    return res.data;
  },

  async resetPassword(email: string, token: string, newPassword: string) {
    const res = await apiClient.post<{ success: boolean; message: string }>('/auth/reset-password', { email, token, newPassword });
    return res.data;
  },
};
