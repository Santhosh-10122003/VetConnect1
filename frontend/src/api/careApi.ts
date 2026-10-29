import { apiClient } from './client';
import type { VerificationStatus } from './doctorApi';

export type CareCategory = 'GROOMING' | 'BOARDING' | 'TRAINING';
export type PetSize = 'SMALL' | 'MEDIUM' | 'LARGE' | 'GIANT';
export type CareBookingStatus = 'AWAITING_PAYMENT' | 'REQUESTED' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'REJECTED' | 'EXPIRED';
export type PaymentStatus = 'CREATED' | 'PAID' | 'FAILED' | 'EXPIRED' | 'REFUNDED' | 'PARTIALLY_REFUNDED';

export const CATEGORIES: { key: CareCategory; label: string; icon: string; blurb: string }[] = [
  { key: 'GROOMING', label: 'Grooming', icon: 'cut-outline', blurb: 'Baths, haircuts, nail care' },
  { key: 'BOARDING', label: 'Boarding', icon: 'bed-outline', blurb: 'Overnight stays and day care' },
  { key: 'TRAINING', label: 'Training', icon: 'school-outline', blurb: 'Obedience and puppy classes' },
];
export const SIZES: { key: PetSize; label: string; hint: string }[] = [
  { key: 'SMALL', label: 'Small', hint: 'up to 7 kg' },
  { key: 'MEDIUM', label: 'Medium', hint: '7 to 20 kg' },
  { key: 'LARGE', label: 'Large', hint: '20 to 35 kg' },
  { key: 'GIANT', label: 'Giant', hint: 'over 35 kg' },
];
export const categoryLabel = (c: string) => CATEGORIES.find((x) => x.key === c)?.label ?? c;
export const sizeFromWeight = (kg?: number | null): PetSize =>
  kg == null ? 'MEDIUM' : kg <= 7 ? 'SMALL' : kg <= 20 ? 'MEDIUM' : kg <= 35 ? 'LARGE' : 'GIANT';
export const priceForSize = (s: CareService, size: PetSize) =>
  ({ SMALL: s.priceSmall, MEDIUM: s.priceMedium, LARGE: s.priceLarge, GIANT: s.priceGiant } as const)[size];

export interface CareService {
  id: number;
  providerId: number;
  category: CareCategory;
  name: string;
  description?: string;
  pricingUnit: 'PER_SESSION' | 'PER_NIGHT';
  durationMinutes?: number | null;
  priceSmall: number;
  priceMedium: number;
  priceLarge: number;
  priceGiant: number;
  isAddon: boolean;
  isActive: boolean;
}

export interface ProviderHours {
  dayOfWeek: number;
  openTime: string;
  closeTime: string;
  isOpen: boolean;
}

export interface Provider {
  id: number;
  userId: number;
  businessName: string;
  description?: string;
  phone?: string;
  email?: string;
  registrationNumber?: string;
  address: string;
  city: string;
  state?: string;
  country?: string;
  postalCode?: string;
  latitude?: number | null;
  longitude?: number | null;
  distanceKm?: number | null;
  categories: CareCategory[];
  ratingAvg: number;
  reviewCount: number;
  advancePercent: number;
  boardingCapacity: number;
  concurrentCapacity: number;
  slotMinutes: number;
  avatarUrl?: string;
  fromPrice?: number | null;
  services?: CareService[];
  hours?: ProviderHours[];
  verificationStatus: VerificationStatus;
  verificationReason?: string;
  reviewedAt?: string;
  resubmittedAt?: string;
  resubmitNote?: string;
  // owner / admin only: where the business is paid (the account number is masked)
  payoutMethod?: 'UPI' | 'BANK' | null;
  upiId?: string | null;
  accountHolderName?: string | null;
  bankAccountMasked?: string | null;
  ifscCode?: string | null;
  bankName?: string | null;
  payoutComplete?: boolean;
}

export interface ProviderPayload {
  businessName: string;
  description?: string;
  phone?: string;
  registrationNumber?: string;
  address: string;
  city: string;
  state?: string;
  country?: string;
  postalCode?: string;
  latitude?: number;
  longitude?: number;
  categories: CareCategory[];
  advancePercent?: number;
  concurrentCapacity?: number;
  boardingCapacity?: number;
  slotMinutes?: number;
  // where the business gets paid: required
  payoutMethod?: 'UPI' | 'BANK';
  upiId?: string;
  accountHolderName?: string;
  bankAccountNumber?: string;
  ifscCode?: string;
  bankName?: string;
}

export interface ServicePayload {
  category: CareCategory;
  name: string;
  description?: string;
  durationMinutes?: number;
  priceSmall: number;
  priceMedium: number;
  priceLarge: number;
  priceGiant: number;
  isAddon?: boolean;
  isActive?: boolean;
}

export interface Slot {
  date: string;
  startTime: string;
  endTime: string;
  available: boolean;
}

export interface BoardingNight {
  date: string;
  remaining: number;
  available: boolean;
}

export interface CarePayment {
  id: number;
  bookingId?: number | null;
  /** Set instead of bookingId for the advance of a vet appointment. */
  appointmentId?: number | null;
  /** Razorpay key for opening the checkout; absent when the built-in test gateway is used. */
  keyId?: string | null;
  gatewayOrderId?: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  gateway: string;
  refundedAmount: number;
  failureReason?: string;
  testMode: boolean;
  paidAt?: string;
}

export interface CareBooking {
  id: number;
  reference: string;
  status: CareBookingStatus;
  category: CareCategory;
  providerId: number;
  providerName: string;
  providerPhone?: string;
  providerAddress?: string;
  providerCity?: string;
  providerLatitude?: number | null;
  providerLongitude?: number | null;
  customerId: number;
  customerName: string;
  customerPhone?: string;
  petId: number;
  petName: string;
  petSpecies?: string;
  petBreed?: string;
  petAllergies?: string;
  petSize: PetSize;
  date: string;
  startTime?: string | null;
  endTime?: string | null;
  checkOutDate?: string | null;
  nights?: number | null;
  notes?: string;
  items: { name: string; price: number; main: boolean }[];
  totalAmount: number;
  advanceAmount: number;
  balanceAmount: number;
  currency: string;
  expiresAt?: string | null;
  cancellationReason?: string;
  cancelledBy?: string;
  payment?: CarePayment | null;
  canReview: boolean;
  reviewed: boolean;
  createdAt?: string;
}

export interface CancellationPreview {
  refundable: boolean;
  refundAmount: number;
  paidAmount: number;
  currency: string;
  windowHours: number;
  message: string;
}

export interface CareReview {
  id: number;
  bookingId: number;
  customerName: string;
  rating: number;
  comment?: string;
  createdAt: string;
}

export interface CareConfig {
  currency: string;
  currencySymbol: string;
  holdMinutes: number;
  cancellationWindowHours: number;
  maxBoardingNights: number;
  paymentsTestMode: boolean;
  paymentGateway: 'simulated' | 'razorpay';
  clinicAdvancePercent: number;
}

export interface CheckoutResult {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}

export interface CreateBookingPayload {
  providerId: number;
  serviceId: number;
  addonIds?: number[];
  petId: number;
  petSize?: PetSize;
  date: string;
  startTime?: string;
  checkOutDate?: string;
  notes?: string;
}

type W<T> = { success: boolean; message?: string; data: T };
type Page<T> = { content: T[]; totalPages: number; totalElements: number };

export const careApi = {
  // ---- customers
  async config() {
    return (await apiClient.get<W<CareConfig>>('/care/config')).data.data;
  },
  async providers(params?: { category?: CareCategory; query?: string; radiusKm?: number; size?: number }) {
    return (await apiClient.get<W<Page<Provider>>>('/care/providers', { params: { size: 50, ...params } })).data.data;
  },
  async provider(id: number) {
    return (await apiClient.get<W<Provider>>(`/care/providers/${id}`)).data.data;
  },
  async slots(providerId: number, serviceId: number, date: string) {
    return (await apiClient.get<W<Slot[]>>(`/care/providers/${providerId}/slots`, { params: { serviceId, date } })).data.data;
  },
  async boardingNights(providerId: number, from: string, to: string) {
    return (await apiClient.get<W<BoardingNight[]>>(`/care/providers/${providerId}/boarding-availability`, { params: { from, to } })).data.data;
  },
  async reviews(providerId: number) {
    return (await apiClient.get<W<Page<CareReview>>>(`/care/providers/${providerId}/reviews`, { params: { size: 10 } })).data.data;
  },
  async createBooking(payload: CreateBookingPayload) {
    return (await apiClient.post<W<CareBooking>>('/care/bookings', payload)).data.data;
  },
  async myBookings(tab: 'UPCOMING' | 'COMPLETED' | 'CANCELLED') {
    return (await apiClient.get<W<Page<CareBooking>>>('/care/bookings/my', { params: { tab } })).data.data;
  },
  async booking(id: number) {
    return (await apiClient.get<W<CareBooking>>(`/care/bookings/${id}`)).data.data;
  },
  async pay(id: number, outcome: 'SUCCESS' | 'FAILURE') {
    return (await apiClient.post<W<CareBooking>>(`/care/bookings/${id}/payment/simulate`, { outcome })).data.data;
  },
  async confirmPayment(id: number, result: CheckoutResult) {
    return (await apiClient.post<W<CareBooking>>(`/care/bookings/${id}/payment/confirm`, result)).data.data;
  },
  async paymentFailed(id: number, reason?: string) {
    return (await apiClient.post<W<CareBooking>>(`/care/bookings/${id}/payment/failed`, { reason })).data.data;
  },
  async retryPayment(id: number) {
    return (await apiClient.post<W<CareBooking>>(`/care/bookings/${id}/payment/retry`)).data.data;
  },
  async cancellationPreview(id: number) {
    return (await apiClient.get<W<CancellationPreview>>(`/care/bookings/${id}/cancellation-preview`)).data.data;
  },
  async cancel(id: number, reason?: string) {
    return (await apiClient.post<W<CareBooking>>(`/care/bookings/${id}/cancel`, { reason })).data.data;
  },
  async review(id: number, rating: number, comment?: string) {
    return (await apiClient.post<W<CareReview>>(`/care/bookings/${id}/review`, { rating, comment })).data.data;
  },

  // ---- the business side
  async myProfile() {
    return (await apiClient.get<W<Provider>>('/provider/profile/me')).data.data;
  },
  async createProfile(payload: ProviderPayload) {
    return (await apiClient.post<W<Provider>>('/provider/profile', payload)).data.data;
  },
  async updateProfile(payload: ProviderPayload) {
    return (await apiClient.put<W<Provider>>('/provider/profile', payload)).data.data;
  },
  async updateHours(hours: ProviderHours[]) {
    return (await apiClient.put<W<Provider>>('/provider/hours', { hours })).data.data;
  },
  async resubmit(note?: string) {
    return (await apiClient.post<W<Provider>>('/provider/profile/resubmit', { note })).data.data;
  },
  async myServices() {
    return (await apiClient.get<W<CareService[]>>('/provider/services')).data.data;
  },
  async addService(payload: ServicePayload) {
    return (await apiClient.post<W<CareService>>('/provider/services', payload)).data.data;
  },
  async updateService(id: number, payload: ServicePayload) {
    return (await apiClient.put<W<CareService>>(`/provider/services/${id}`, payload)).data.data;
  },
  async removeService(id: number) {
    await apiClient.delete(`/provider/services/${id}`);
  },
  async providerBookings(group: 'REQUESTED' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED') {
    return (await apiClient.get<W<Page<CareBooking>>>('/provider/bookings', { params: { group } })).data.data;
  },
  async accept(id: number) {
    return (await apiClient.post<W<CareBooking>>(`/provider/bookings/${id}/accept`)).data.data;
  },
  async reject(id: number, reason: string) {
    return (await apiClient.post<W<CareBooking>>(`/provider/bookings/${id}/reject`, { reason })).data.data;
  },
  async providerCancel(id: number, reason: string) {
    return (await apiClient.post<W<CareBooking>>(`/provider/bookings/${id}/cancel`, { reason })).data.data;
  },
  async complete(id: number) {
    return (await apiClient.post<W<CareBooking>>(`/provider/bookings/${id}/complete`)).data.data;
  },
};
