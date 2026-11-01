import { colors } from '../theme/colors';
import { Ionicons } from '@expo/vector-icons';

export interface ScreenGuideItem {
  id: string;
  screenName: string;
  tabName?: string;
  role: 'ROLE_CUSTOMER' | 'ROLE_DOCTOR' | 'ROLE_PROVIDER';
  badge: string;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  description: string;
  easyHighlights: string[];
  easyTip: string;
  mockType: 'home' | 'doctors' | 'appointments' | 'care' | 'pets' | 'profile' | 'doctor_dash' | 'provider_home';
  navigationTarget?: { screen: string; tab?: string };
}

export const CUSTOMER_SCREEN_GUIDE: ScreenGuideItem[] = [
  {
    id: 'customer-home',
    screenName: 'Home',
    tabName: 'Home',
    role: 'ROLE_CUSTOMER',
    badge: 'Step 1 • Command Center',
    title: 'Home: Smart Pet Care Hub',
    subtitle: 'Everything your pet needs, just one tap away',
    icon: 'home',
    color: colors.primaryLight,
    description: 'Your starting point every day. View upcoming vet visits and pet care bookings at a glance, or jump directly into booking any service.',
    easyHighlights: [
      'Quick-action tiles for Veterinary, Grooming, Boarding, Training, and Pets',
      'Instant Search button in the top bar to find clinics by name or specialty',
      'Notification bell alerting you to appointment approvals, reminders & messages',
      'Live "Upcoming" cards showing your next confirmed visit and countdown',
    ],
    easyTip: '💡 Tap any service tile on Home to skip searching and go straight to booking options.',
    mockType: 'home',
    navigationTarget: { screen: 'CustomerTabs', tab: 'Home' },
  },
  {
    id: 'customer-doctors',
    screenName: 'Find Doctors',
    tabName: 'FindDoctors',
    role: 'ROLE_CUSTOMER',
    badge: 'Step 2 • Verified Vets',
    title: 'Doctors: Find Verified Vets',
    subtitle: 'Locate top veterinarians nearby with clinic map pins',
    icon: 'medkit',
    color: '#0EA5E9',
    description: 'Explore verified veterinary practitioners near you. See clinic addresses, consultation fees, experience, and verified council credentials.',
    easyHighlights: [
      'Search by doctor name, clinic name, or specialty (Dermatology, Surgery, etc.)',
      'Calculated distance from your location (default within 25 km, expandable to 100 km)',
      'Pinpoint clinic map location with one-tap "Get Directions" navigation',
      'Select convenient available consultation date and 15-minute slot hold',
    ],
    easyTip: '💡 Ensure your GPS pin or district is set in your profile so Jenni can calculate exact road distances to nearby clinics.',
    mockType: 'doctors',
    navigationTarget: { screen: 'CustomerTabs', tab: 'FindDoctors' },
  },
  {
    id: 'customer-appointments',
    screenName: 'Appointments',
    tabName: 'Appointments',
    role: 'ROLE_CUSTOMER',
    badge: 'Step 3 • Visits & Tracking',
    title: 'Visits: Manage Appointments',
    subtitle: 'Track your consultations, slots, notes & prescriptions',
    icon: 'calendar',
    color: '#10B981',
    description: 'Keep track of all current, upcoming, and past vet consultations. Easily reschedule if your day changes, or view prescriptions.',
    easyHighlights: [
      'Filtered tabs for UPCOMING, COMPLETED, and CANCELLED appointments',
      'Only 50% advance required online; pay the remainder directly at the clinic',
      'Request appointment reschedules easily with doctor approval',
      'Access doctor consultation notes and digital prescriptions directly in the app',
    ],
    easyTip: '💡 If you cancel at least 24 hours prior, your advance payment is refunded 100% automatically.',
    mockType: 'appointments',
    navigationTarget: { screen: 'CustomerTabs', tab: 'Appointments' },
  },
  {
    id: 'customer-care',
    screenName: 'Pet Care',
    tabName: 'PetCare',
    role: 'ROLE_CUSTOMER',
    badge: 'Step 4 • Grooming & Boarding',
    title: 'Pet Care: Pamper Your Pet',
    subtitle: 'Book professional grooming, overnight boarding & training',
    icon: 'cut',
    color: '#8B5CF6',
    description: 'Book trusted pet care facilities for spa sessions, daycare, overnight boarding, or behavioral training with transparent pricing.',
    easyHighlights: [
      'Filter by Grooming, Boarding, or Training with 1 tap',
      'Transparent tiered pricing according to your pet size (Small, Medium, Large, Giant)',
      'See verified business credentials, trade license, and partner vet details',
      'Select custom add-on services like medicated bath, nail trimming, or puppy training',
    ],
    easyTip: '💡 When booking boarding, choose start and end dates to see real-time nightly rates and capacity.',
    mockType: 'care',
    navigationTarget: { screen: 'CustomerTabs', tab: 'PetCare' },
  },
  {
    id: 'customer-pets',
    screenName: 'My Pets',
    tabName: 'Pets',
    role: 'ROLE_CUSTOMER',
    badge: 'Step 5 • Pet Profiles',
    title: 'My Pets: Health & Profiles',
    subtitle: 'Keep your pets medical records and details in one place',
    icon: 'paw',
    color: '#F59E0B',
    description: 'Manage your furry family members! Store pet photos, breed, age, weight, allergies, and vaccination history.',
    easyHighlights: [
      'Add multiple pets: dogs, cats, birds, and other companions',
      'Quickly select your saved pet during vet and care checkout in 1 tap',
      'View comprehensive medical history, past doctor diagnoses, and prescriptions',
      'Keep track of allergies and special dietary needs for pet care providers',
    ],
    easyTip: '💡 Add your pet first before booking your first consultation to auto-fill their health history for the doctor.',
    mockType: 'pets',
    navigationTarget: { screen: 'CustomerTabs', tab: 'Pets' },
  },
  {
    id: 'customer-profile',
    screenName: 'Profile',
    tabName: 'Profile',
    role: 'ROLE_CUSTOMER',
    badge: 'Step 6 • Account & Support',
    title: 'Profile: Location & Emergency',
    subtitle: 'Control your address, emergency contacts and settings',
    icon: 'person',
    color: '#6366F1',
    description: 'Customize your personal details, home location pin, emergency contact phone, and find instant 24x7 helpline assistance.',
    easyHighlights: [
      'Update Country, State, District, and OpenStreetMap GPS location pin',
      'Store an Emergency Contact number for quick reach in case of veterinary needs',
      'Access 24x7 Poison & Emergency hotlines anytime under Help & Support',
      'Want to offer pet care? Apply to become a business provider directly here',
    ],
    easyTip: '💡 Pin your exact home location on the map to find clinics within walking or short driving distance.',
    mockType: 'profile',
    navigationTarget: { screen: 'CustomerTabs', tab: 'Profile' },
  },
];

export const DOCTOR_SCREEN_GUIDE: ScreenGuideItem[] = [
  {
    id: 'doctor-dashboard',
    screenName: 'Today Dashboard',
    tabName: 'DoctorDashboard',
    role: 'ROLE_DOCTOR',
    badge: 'Doctor Hub',
    title: 'Today: Daily Overview',
    subtitle: 'Review today appointments and quick earnings',
    icon: 'today',
    color: colors.primaryLight,
    description: 'See today scheduled consultations, accepted requests, and pending actions at a glance.',
    easyHighlights: [
      'Quick glance at confirmed consultations for the day',
      'Track total advance earnings in your wallet',
      'Quick toggle to jump into calendar and slot management',
    ],
    easyTip: '💡 Review incoming appointment requests early so pet owners get swift confirmation.',
    mockType: 'doctor_dash',
    navigationTarget: { screen: 'DoctorTabs', tab: 'DoctorDashboard' },
  },
  {
    id: 'doctor-appointments',
    screenName: 'Appointments Queue',
    tabName: 'DoctorAppointments',
    role: 'ROLE_DOCTOR',
    badge: 'Patient Requests',
    title: 'Appointments: Accept & Consult',
    subtitle: 'Manage client requests, reschedule, and write prescriptions',
    icon: 'list',
    color: '#10B981',
    description: 'Accept or decline consultation requests, approve reschedules, and create digital prescriptions.',
    easyHighlights: [
      'Accept or reject requests with clear reasons',
      'Review pet medical history and owner notes before consultation',
      'Add consultation notes and prescriptions once the visit is completed',
    ],
    easyTip: '💡 Writing consultation notes directly in Jenni updates the pet medical history instantly.',
    mockType: 'appointments',
    navigationTarget: { screen: 'DoctorTabs', tab: 'DoctorAppointments' },
  },
  {
    id: 'doctor-calendar',
    screenName: 'Availability',
    tabName: 'AvailabilityManagement',
    role: 'ROLE_DOCTOR',
    badge: 'Slot Management',
    title: 'Calendar: Manage Slots',
    subtitle: 'Configure working hours and block break times',
    icon: 'calendar',
    color: '#F59E0B',
    description: 'Set your regular clinic hours, define slot lengths, and block personal leaves or lunch breaks.',
    easyHighlights: [
      'Set working days and morning/evening hours',
      'Block individual slots for surgeries or breaks without affecting booked visits',
      'View daily slot availability status for pet owners',
    ],
    easyTip: '💡 Block out lunch breaks or surgery hours in advance so pet owners book only available times.',
    mockType: 'appointments',
    navigationTarget: { screen: 'DoctorTabs', tab: 'AvailabilityManagement' },
  },
];

export const PROVIDER_SCREEN_GUIDE: ScreenGuideItem[] = [
  {
    id: 'provider-home',
    screenName: 'Provider Home',
    tabName: 'ProviderHome',
    role: 'ROLE_PROVIDER',
    badge: 'Business Hub',
    title: 'Home: Pet Care Operations',
    subtitle: 'Manage daily grooming, boarding and training bookings',
    icon: 'storefront',
    color: colors.primaryLight,
    description: 'Monitor active bookings, daily capacity, and upcoming client drop-offs in one clean screen.',
    easyHighlights: [
      'View active requests for Grooming, Boarding, and Training',
      'Track real-time capacity and booked slots',
      'Directly view advance payments credited to your wallet',
    ],
    easyTip: '💡 Confirm booking requests promptly so pet parents know their slot is guaranteed.',
    mockType: 'provider_home',
    navigationTarget: { screen: 'ProviderHome' },
  },
  {
    id: 'provider-services',
    screenName: 'Services & Menu',
    tabName: 'ProviderServices',
    role: 'ROLE_PROVIDER',
    badge: 'Service Pricing',
    title: 'Menu: Pricing & Pet Sizes',
    subtitle: 'Configure size-based pricing tiers and add-ons',
    icon: 'pricetags',
    color: '#8B5CF6',
    description: 'Set custom pricing for small, medium, large, and giant pets, and add special grooming packages.',
    easyHighlights: [
      'Tailor prices per pet size category',
      'Set flat add-on service rates (e.g., tick wash, coat conditioning)',
      'Manage daily capacity per service',
    ],
    easyTip: '💡 Transparent pricing helps pet owners choose the right service without friction.',
    mockType: 'care',
    navigationTarget: { screen: 'ProviderServices' },
  },
];

export const getScreenGuideForRole = (role?: string): ScreenGuideItem[] => {
  if (role === 'ROLE_DOCTOR') return DOCTOR_SCREEN_GUIDE;
  if (role === 'ROLE_PROVIDER') return PROVIDER_SCREEN_GUIDE;
  return CUSTOMER_SCREEN_GUIDE;
};

