import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tabBarOptions } from '../theme/tabBar';
import { DoctorStackParamList, DoctorTabParamList } from './types';
import { DoctorDashboardScreen } from '../screens/doctor/DoctorDashboardScreen';
import { DoctorAppointmentsScreen } from '../screens/doctor/DoctorAppointmentsScreen';
import { DoctorAppointmentDetailsScreen } from '../screens/doctor/DoctorAppointmentDetailsScreen';
import { AvailabilityManagementScreen } from '../screens/doctor/AvailabilityManagementScreen';
import { ConsultationNotesScreen } from '../screens/doctor/ConsultationNotesScreen';
import { DoctorProfileScreen } from '../screens/doctor/DoctorProfileScreen';
import { ProviderStack } from './ProviderNavigator';
import { NotificationsScreen } from '../screens/customer/NotificationsScreen';

const Tab = createBottomTabNavigator<DoctorTabParamList>();
const Stack = createNativeStackNavigator<DoctorStackParamList>();

const ICONS: Record<keyof DoctorTabParamList, [keyof typeof Ionicons.glyphMap, keyof typeof Ionicons.glyphMap]> = {
  DoctorDashboard: ['today', 'today-outline'],
  DoctorAppointments: ['list', 'list-outline'],
  AvailabilityManagement: ['calendar', 'calendar-outline'],
  PetCareBusiness: ['cut', 'cut-outline'],
  DoctorProfile: ['person', 'person-outline'],
};

const DoctorTabs: React.FC = () => {
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
      <Tab.Screen name="DoctorDashboard" component={DoctorDashboardScreen} options={{ title: 'Today' }} />
      <Tab.Screen name="DoctorAppointments" component={DoctorAppointmentsScreen} options={{ title: 'Appointments' }} />
      <Tab.Screen name="AvailabilityManagement" component={AvailabilityManagementScreen} options={{ title: 'Calendar' }} />
      <Tab.Screen name="PetCareBusiness" component={ProviderStack} options={{ title: 'Pet Care' }} />
      <Tab.Screen name="DoctorProfile" component={DoctorProfileScreen} options={{ title: 'Profile' }} />
    </Tab.Navigator>
  );
};

export const DoctorNavigator: React.FC = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="DoctorTabs" component={DoctorTabs} />
    <Stack.Screen name="DoctorAppointmentDetails" component={DoctorAppointmentDetailsScreen} />
    <Stack.Screen name="ConsultationNotes" component={ConsultationNotesScreen} />
    <Stack.Screen name="DoctorNotifications" component={NotificationsScreen} />
  </Stack.Navigator>
);
