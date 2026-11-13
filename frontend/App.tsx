import React, { useEffect, useState } from 'react';
import { DeepLinkHandler } from './src/navigation/DeepLinkHandler';
import { navigationRef } from './src/navigation/navigationRef';
import { TourProvider } from './src/tour/TourProvider';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PaperProvider } from 'react-native-paper';
import { AuthProvider } from './src/context/AuthContext';
import { RootNavigator } from './src/navigation/RootNavigator';
import { paperTheme } from './src/theme/theme';
import { ThemeProvider } from './src/theme/ThemeProvider';
import { colors } from './src/theme/colors';
import { View } from 'react-native';
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
      <ThemeProvider>
        <Themed />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

/** Everything that has colours. Jenni has one look: light. */
function Themed() {
  const navTheme = {
    ...DefaultTheme,
    colors: { ...DefaultTheme.colors, background: colors.background, card: colors.card, text: colors.text, border: colors.border, primary: colors.primaryLight },
  };
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <PaperProvider theme={paperTheme('light')}>
        <AuthProvider>
          <NavigationContainer ref={navigationRef} theme={navTheme}>
            <TourProvider>
              <DeepLinkHandler />
              <RootNavigator />
            </TourProvider>
          </NavigationContainer>
          <StatusBar style="dark" />
        </AuthProvider>
      </PaperProvider>
    </View>
  );
}
