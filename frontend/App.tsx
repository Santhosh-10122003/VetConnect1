import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PaperProvider } from 'react-native-paper';
import { AuthProvider } from './src/context/AuthContext';
import { RootNavigator } from './src/navigation/RootNavigator';
import { theme } from './src/theme/theme';
import { careApi } from './src/api/careApi';
import { setCurrencySymbol, setClinicAdvancePercent, setPaymentGateway } from './src/utils/helpers';

export default function App() {
  // Prices are shown in the currency the server is configured with; wait briefly so the first screen already uses it.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    Promise.race([careApi.config(), new Promise<never>((_, no) => setTimeout(no, 3000))])
      .then((c) => { setCurrencySymbol(c.currencySymbol); setClinicAdvancePercent(c.clinicAdvancePercent); setPaymentGateway(c.paymentGateway); })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);
  if (!ready) return null;

  return (
    <SafeAreaProvider>
      <PaperProvider theme={theme}>
        <AuthProvider>
          <NavigationContainer>
            <RootNavigator />
          </NavigationContainer>
          <StatusBar style="dark" />
        </AuthProvider>
      </PaperProvider>
    </SafeAreaProvider>
  );
}
