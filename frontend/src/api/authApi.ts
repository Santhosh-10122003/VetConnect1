import { apiClient } from './client';

export interface RegisterPayload {
  /** Optional: accounts are identified by the mobile number. */
  email?: string;
  password: string;
  confirmPassword?: string;
  /** Mobile number in international form (+919876543210). */
  phone: string;
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
  payoutMethod?: 'UPI' | 'BANK';
  upiId?: string;
  accountHolderName?: string;
  bankAccountNumber?: string;
  ifscCode?: string;
  bankName?: string;
  clinicCity?: string;
  clinicPostalCode?: string;
  latitude?: number;
  longitude?: number;
}

/** Sign-up creates an unverified account; the user must confirm the emailed code before logging in. */
export interface RegistrationResult {
  email?: string;
  /** The mobile number the verification code was sent to. */
  mobile: string;
  verificationRequired: boolean;
  otpExpiresInMinutes: number;
}

export interface LoginPayload {
  /** Mobile number (older accounts may still use their email here). */
  mobile: string;
  password: string;
}

export interface AuthResponseData {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  userId: number;
  email?: string | null;
  phone?: string | null;
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

  async verifyOtp(mobile: string, otp: string) {
    const res = await apiClient.post<{ success: boolean; message: string; data: AuthResponseData }>('/auth/verify-otp', { mobile, otp });
    return res.data;
  },

  async resendOtp(mobile: string) {
    const res = await apiClient.post<{ success: boolean; message: string }>('/auth/resend-otp', { mobile });
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

  async forgotPassword(mobile: string) {
    const res = await apiClient.post<{ success: boolean; message: string }>('/auth/forgot-password', { mobile });
    return res.data;
  },

  async resetPassword(mobile: string, token: string, newPassword: string) {
    const res = await apiClient.post<{ success: boolean; message: string }>('/auth/reset-password', { mobile, token, newPassword });
    return res.data;
  },
};
