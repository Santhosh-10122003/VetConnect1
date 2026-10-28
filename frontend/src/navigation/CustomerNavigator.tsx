import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tabBarOptions } from '../theme/tabBar';
import { CustomerStackParamList, CustomerTabParamList } from './types';
import { HomeScreen } from '../screens/customer/HomeScreen';
import { FindDoctorsScreen } from '../screens/customer/FindDoctorsScreen';
import { DoctorProfileScreen } from '../screens/customer/DoctorProfileScreen';
import { BookAppointmentScreen } from '../screens/customer/BookAppointmentScreen';
import { BookingSummaryScreen } from '../screens/customer/BookingSummaryScreen';
import { MyAppointmentsScreen } from '../screens/customer/MyAppointmentsScreen';
import { AppointmentDetailsScreen } from '../screens/customer/AppointmentDetailsScreen';
import { PetListScreen } from '../screens/customer/PetListScreen';
import { AddEditPetScreen } from '../screens/customer/AddEditPetScreen';
import { PetDetailsScreen } from '../screens/customer/PetDetailsScreen';
import { AddReviewScreen } from '../screens/customer/AddReviewScreen';
import { NotificationsScreen } from '../screens/customer/NotificationsScreen';
import { CustomerProfileScreen } from '../screens/customer/CustomerProfileScreen';
import { HelpSupportScreen } from '../screens/customer/HelpSupportScreen';
import { CareHomeScreen } from '../screens/customer/CareHomeScreen';
import { AppointmentPaymentScreen } from '../screens/customer/AppointmentPaymentScreen';
import { CareProviderScreen } from '../screens/customer/CareProviderScreen';
import { CareBookScreen } from '../screens/customer/CareBookScreen';
import { CarePaymentScreen } from '../screens/customer/CarePaymentScreen';
import { CareBookingsScreen } from '../screens/customer/CareBookingsScreen';
import { CareBookingDetailsScreen } from '../screens/customer/CareBookingDetailsScreen';
import { CareReviewScreen } from '../screens/customer/CareReviewScreen';

const Tab = createBottomTabNavigator<CustomerTabParamList>();
const Stack = createNativeStackNavigator<CustomerStackParamList>();

const ICONS: Record<keyof CustomerTabParamList, [keyof typeof Ionicons.glyphMap, keyof typeof Ionicons.glyphMap]> = {
  Home: ['home', 'home-outline'],
  FindDoctors: ['search', 'search-outline'],
  Appointments: ['calendar', 'calendar-outline'],
  PetCare: ['cut', 'cut-outline'],
  Pets: ['paw', 'paw-outline'],
  Profile: ['person', 'person-outline'],
};

const CustomerTabs: React.FC = () => {
  const insets = useSafeAreaInsets();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        ...tabBarOptions(insets.bottom),
        tabBarIcon: ({ focused, color, size }) => (
          <Ionicons name={ICONS[route.name][focused ? 0 : 1]} size={size} color={color} />
        ),
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="FindDoctors" component={FindDoctorsScreen} options={{ title: 'Doctors' }} />
      <Tab.Screen name="Appointments" component={MyAppointmentsScreen} options={{ title: 'Visits' }} />
      <Tab.Screen name="PetCare" component={CareHomeScreen} options={{ title: 'Pet Care' }} />
      <Tab.Screen name="Pets"component={PetListScreen} />
      <Tab.Screen name="Profile" component={CustomerProfileScreen} />
    </Tab.Navigator>
  );
};

export const CustomerNavigator: React.FC = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="CustomerTabs" component={CustomerTabs} />
    <Stack.Screen name="DoctorProfile" component={DoctorProfileScreen} />
    <Stack.Screen name="BookAppointment" component={BookAppointmentScreen} />
    <Stack.Screen name="BookingSummary" component={BookingSummaryScreen} />
    <Stack.Screen name="AppointmentPayment" component={AppointmentPaymentScreen} options={{ gestureEnabled: false }} />
    <Stack.Screen name="AppointmentDetails" component={AppointmentDetailsScreen} />
    <Stack.Screen name="AddEditPet" component={AddEditPetScreen} />
    <Stack.Screen name="PetDetails" component={PetDetailsScreen} />
    <Stack.Screen name="AddReview" component={AddReviewScreen} />
    <Stack.Screen name="Notifications" component={NotificationsScreen} />
    <Stack.Screen name="HelpSupport" component={HelpSupportScreen} />
    <Stack.Screen name="CareProvider" component={CareProviderScreen} />
    <Stack.Screen name="CareBook" component={CareBookScreen} />
    <Stack.Screen name="CarePayment" component={CarePaymentScreen} options={{ gestureEnabled: false }} />
    <Stack.Screen name="CareBookings" component={CareBookingsScreen} />
    <Stack.Screen name="CareBookingDetails" component={CareBookingDetailsScreen} />
    <Stack.Screen name="CareReview" component={CareReviewScreen} />
  </Stack.Navigator>
);
