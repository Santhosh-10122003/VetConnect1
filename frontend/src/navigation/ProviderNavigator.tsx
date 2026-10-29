import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ProviderStackParamList } from './types';
import { ProviderHomeScreen } from '../screens/provider/ProviderHomeScreen';
import { ProviderSetupScreen } from '../screens/provider/ProviderSetupScreen';
import { ProviderBookingsScreen } from '../screens/provider/ProviderBookingsScreen';
import { ProviderServicesScreen } from '../screens/provider/ProviderServicesScreen';
import { ProviderServiceEditScreen } from '../screens/provider/ProviderServiceEditScreen';
import { ProviderHoursScreen } from '../screens/provider/ProviderHoursScreen';
import { WalletScreen } from '../screens/shared/WalletScreen';
import { ProviderProfileScreen } from '../screens/provider/ProviderProfileScreen';

const Stack = createNativeStackNavigator<ProviderStackParamList>();

/** The pet-care business screens. Used on their own for a business account, and as a tab for vet doctors. */
export const ProviderStack: React.FC = () => (
  <Stack.Navigator initialRouteName="ProviderHome" screenOptions={{ headerShown: false }}>
    <Stack.Screen name="ProviderHome" component={ProviderHomeScreen} />
    <Stack.Screen name="ProviderSetup" component={ProviderSetupScreen} />
    <Stack.Screen name="ProviderBookings" component={ProviderBookingsScreen} />
    <Stack.Screen name="ProviderServices" component={ProviderServicesScreen} />
    <Stack.Screen name="ProviderServiceEdit" component={ProviderServiceEditScreen} />
    <Stack.Screen name="ProviderHours" component={ProviderHoursScreen} />
    <Stack.Screen name="ProviderProfile" component={ProviderProfileScreen} />
    <Stack.Screen name="ProviderWallet" component={WalletScreen} />
  </Stack.Navigator>
);

export const ProviderNavigator = ProviderStack;
