/** One stop of the guided tour: what to point at, and what to say. Without a target the card sits in the middle. */
export interface TourStep {
  target?: string;
  title: string;
  text: string;
}

/** Where each role's tour starts, so every step finds its target on screen. */
export const TOUR_HOME: Record<string, { name: string; params?: object }> = {
  ROLE_CUSTOMER: { name: 'CustomerTabs', params: { screen: 'Home' } },
  ROLE_DOCTOR: { name: 'DoctorTabs', params: { screen: 'DoctorDashboard' } },
  ROLE_PROVIDER: { name: 'ProviderHome' },
};

export const TOURS: Record<string, TourStep[]> = {
  ROLE_CUSTOMER: [
    { target: 'home-welcome', title: 'Home', text: 'Welcome to the main screen. Here you can see what is coming up and reach every part of the app in one tap.' },
    { target: 'home-search', title: 'Search', text: 'Looking for a vet or a clinic near you? Search here and book a visit.' },
    { target: 'home-bell', title: 'Notifications', text: 'Booking confirmations, answers to reschedule requests, reminders and payment updates arrive here. A dot means something new.' },
    { target: 'home-tile-vet', title: 'See a vet', text: 'Find vets near you, see their fees and free times, and book a visit with a small advance payment.' },
    { target: 'home-tile-grooming', title: 'Grooming, boarding and training', text: 'Browse pet-care businesses, pick a service, choose a slot and pay the advance to confirm.' },
    { target: 'home-tile-visits', title: 'My visits', text: 'Your coming and past vet visits. You can change the time or cancel from here.' },
    { target: 'home-tile-pets', title: 'My pets', text: 'Add your pets once. Their details are filled in for you every time you book.' },
    { target: 'tab-FindDoctors', title: 'Doctors', text: 'The full list of vets, with distance, fees, ratings and a map.' },
    { target: 'tab-Appointments', title: 'Visits', text: 'Every appointment and its status, from waiting for the advance to completed.' },
    { target: 'tab-PetCare', title: 'Pet Care', text: 'Grooming, boarding and training near you, and your pet-care bookings.' },
    { target: 'tab-Pets', title: 'Pets', text: 'Your pets, their health notes, visit history and vaccinations.' },
    { target: 'tab-Profile', title: 'Profile', text: 'Your details and help. You can also replay this tour from here whenever you like.' },
  ],
  ROLE_DOCTOR: [
    { title: 'Welcome, doctor', text: 'This is your clinic dashboard. A quick look at where things are.' },
    { target: 'doc-wallet', title: 'Wallet', text: 'The advances pet owners pay land here. Tap it to see every credit and refund.' },
    { target: 'doc-slots', title: 'Your day', text: 'Today at a glance: booked, free and blocked slots. Tap it to block time for a call-in or a break, and to call your customers.' },
    { target: 'tab-DoctorAppointments', title: 'Appointments', text: 'Every booking is confirmed as soon as the pet owner pays, and you are notified. Reschedule requests to answer, and your visits, are here.' },
    { target: 'tab-AvailabilityManagement', title: 'Calendar', text: 'Set your weekly hours and breaks, and add days you are away.' },
    { target: 'tab-DoctorProfile', title: 'Profile', text: 'Your details, credentials and documents. If the admin ever asks for changes, you edit them here. You can also replay this tour.' },
  ],
  ROLE_PROVIDER: [
    { title: 'Welcome', text: 'This is your pet-care business home. A quick look at where things are.' },
    { target: 'prov-wallet', title: 'Wallet', text: 'The advances customers pay land here. Tap it to see every credit and refund.' },
    { target: 'prov-tile-0', title: 'Upcoming bookings', text: 'A booking is confirmed the moment the pet owner pays the advance, and you get a notification. Your upcoming work is listed here.' },
    { target: 'prov-tile-2', title: 'My services', text: 'Your menu: services, prices and extras. Customers can only book what is listed.' },
    { target: 'prov-tile-3', title: 'Hours and capacity', text: 'Opening hours, how many pets you can take at once, and the advance percentage.' },
    { target: 'prov-tile-4', title: 'Business profile', text: 'Your details, location pin, trade licence and documents. If the admin asks for changes, you make them here.' },
  ],
};
