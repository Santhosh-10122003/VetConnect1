import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { AuthStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'Splash'>;

export const SplashScreen: React.FC<Props> = ({ navigation }) => {
  useEffect(() => {
    const timer = setTimeout(() => navigation.replace('Onboarding'), 1800);
    return () => clearTimeout(timer);
  }, [navigation]);

  return (
    <View style={styles.container}>
      <View style={[styles.blob, { top: -90, right: -70, width: 260, height: 260 }]} />
      <View style={[styles.blob, { bottom: -110, left: -80, width: 300, height: 300 }]} />
      <View style={styles.logoCircle}>
        <Ionicons name="paw" size={56} color="#FFFFFF" />
      </View>
      <Text style={styles.appName}>VetConnect</Text>
      <Text style={styles.tagline}>Smart pet care, all in one place.</Text>
      <ActivityIndicator size="small" color={colors.primary} style={styles.spinner} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', padding: 24, overflow: 'hidden' },
  blob: { position: 'absolute', borderRadius: 999, backgroundColor: colors.mintDark },
  logoCircle: { width: 110, height: 110, borderRadius: 55, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  appName: { fontSize: 36, fontWeight: '800', color: colors.primary, letterSpacing: -0.5 },
  tagline: { fontSize: 15, color: colors.textSecondary, marginTop: 8, textAlign: 'center' },
  spinner: { marginTop: 36 },
});
