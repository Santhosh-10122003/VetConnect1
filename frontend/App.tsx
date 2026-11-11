import React, { useEffect, useRef, useState } from 'react';
import { DeepLinkHandler } from './src/navigation/DeepLinkHandler';
import { navigationRef } from './src/navigation/navigationRef';
import { TourProvider } from './src/tour/TourProvider';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DefaultTheme, DarkTheme, NavigationState } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PaperProvider } from 'react-native-paper';
import { AuthProvider } from './src/context/AuthContext';
import { RootNavigator } from './src/navigation/RootNavigator';
import { paperTheme } from './src/theme/theme';
import { ThemeProvider, useAppTheme } from './src/theme/ThemeProvider';
import { colors, nightGradient } from './src/theme/colors';
import { View, StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
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

/** Everything that has colours. Changing the theme rebuilds this part, and the screen you were on is restored. */
function Themed() {
  const { scheme } = useAppTheme();
  const saved = useRef<NavigationState | undefined>(undefined);
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...base,
    colors: { ...base.colors, background: scheme === 'dark' ? 'transparent' : colors.background, card: colors.card, text: colors.text, border: colors.border, primary: colors.primaryLight },
  };
  return (
    <View style={{ flex: 1, backgroundColor: scheme === 'dark' ? nightGradient[0] : colors.background }}>
    {scheme === 'dark' && <Backdrop />}
    <PaperProvider theme={paperTheme(scheme)} key={scheme}>
      <AuthProvider>
        <NavigationContainer ref={navigationRef} theme={navTheme} initialState={saved.current} onStateChange={(st) => { saved.current = st; }}>
          <TourProvider>
            <DeepLinkHandler />
            <RootNavigator />
          </TourProvider>
        </NavigationContainer>
        <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      </AuthProvider>
    </PaperProvider>
    </View>
  );
}

/** Near-black to deep plum, behind every screen in dark mode. */
function Backdrop() {
  return (
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" preserveAspectRatio="none" pointerEvents="none">
      <Defs>
        <LinearGradient id="night" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={nightGradient[0]} />
          <Stop offset="0.55" stopColor={nightGradient[1]} />
          <Stop offset="1" stopColor={nightGradient[2]} />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#night)" />
    </Svg>
  );
}
