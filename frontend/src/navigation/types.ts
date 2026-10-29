import { NavigatorScreenParams } from '@react-navigation/native';

export type AuthStackParamList = {
  Splash: undefined;
  Onboarding: undefined;
  Login: undefined;
  Register: { defaultRole?: 'ROLE_CUSTOMER' | 'ROLE_DOCTOR' } | undefined;
  VerifyOtp: { mobile: string };
  ForgotPassword: undefined;
  ResetPassword: { mobile?: string } | undefined;
};

export type CustomerTabParamList = {
  Home: undefined;
  FindDoctors: { specializationId?: number; query?: string } | undefined;
  Appointments: { initialTab?: 'UPCOMING' | 'COMPLETED' | 'CANCELLED' } | undefined;
  PetCare: { category?: 'GROOMING' | 'BOARDING' | 'TRAINING' } | undefined;
  Pets: undefined;
  Profile: undefined;
};

export type CustomerStackParamList = {
  CustomerTabs: NavigatorScreenParams<CustomerTabParamList>;
  DoctorProfile: { doctorId: number };
  BookAppointment: { doctorId: number; preselectedDate?: string };
  BookingSummary: { appointmentId: number };
  AppointmentPayment: { appointmentId: number };
  AppointmentDetails: { appointmentId: number };
  AddEditPet: { petId?: number } | undefined;
  PetDetails: { petId: number };
  AddReview: { doctorId: number; doctorName: string; appointmentId: number };
  Notifications: undefined;
  HelpSupport: undefined;
  CareProvider: { providerId: number };
  CareBook: { providerId: number; serviceId: number };
  CarePayment: { bookingId: number };
  CareBookings: undefined;
  CareBookingDetails: { bookingId: number };
  CareReview: { bookingId: number; providerName: string };
};

export type DoctorTabParamList = {
  DoctorDashboard: undefined;
  DoctorAppointments: { initialStatus?: string } | undefined;
  AvailabilityManagement: undefined;
  DoctorProfile: undefined;
  /** A vet clinic that also offers grooming, boarding or training. */
  PetCareBusiness: undefined;
};

export type DoctorStackParamList = {
  DoctorTabs: NavigatorScreenParams<DoctorTabParamList>;
  DoctorAppointmentDetails: { appointmentId: number };
  ConsultationNotes: { appointmentId: number; petId: number; petName: string };
  DoctorNotifications: undefined;
  DoctorWallet: undefined;
  DoctorSlots: undefined;
};

export type ProviderStackParamList = {
  ProviderHome: undefined;
  ProviderSetup: undefined;
  ProviderBookings: { group?: 'REQUESTED' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' } | undefined;
  ProviderServices: undefined;
  ProviderServiceEdit: { serviceId?: number } | undefined;
  ProviderHours: undefined;
  ProviderProfile: undefined;
  ProviderWallet: undefined;
};

export type AdminStackParamList = {
  AdminDashboard: undefined;
  /** "new" = first-time applicants, "resubmitted" = doctors asking to be reviewed again. */
  DoctorVerification: { mode?: 'new' | 'resubmitted'; kind?: 'doctor' | 'provider' } | undefined;
};
