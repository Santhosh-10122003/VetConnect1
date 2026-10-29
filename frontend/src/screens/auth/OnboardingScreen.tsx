import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, useWindowDimensions } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { SlideToStart } from '../../components/common/SlideToStart';
import { AuthStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'Onboarding'>;

/** One welcome page: a big pale-sky shape, bold words, and a bar to slide to get started. */
export const OnboardingScreen: React.FC<Props> = ({ navigation }) => {
  const { width } = useWindowDimensions();

  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <View style={[styles.blob, { width: width * 1.3, height: width * 1.3, top: -width * 0.55, left: -width * 0.15 }]} />
        <View style={[styles.blob, { width: width * 0.7, height: width * 0.7, top: width * 0.2, right: -width * 0.25 }]} />
        <View style={[styles.blob, { width: width * 0.5, height: width * 0.5, top: width * 0.5, left: width * 0.05 }]} />
        <Ionicons name="paw" size={34} color="#FFFFFF" style={{ position: 'absolute', top: 70, right: 36, transform: [{ rotate: '18deg' }] }} />
        <Ionicons name="paw" size={24} color="#FFFFFF" style={{ position: 'absolute', top: 40, right: 100, transform: [{ rotate: '-12deg' }] }} />
        <Ionicons name="paw" size={20} color="#FFFFFF" style={{ position: 'absolute', top: 110, right: 90, transform: [{ rotate: '25deg' }] }} />
        <Text style={styles.brand}>Vet<Text style={styles.brandSoft}>Connect</Text></Text>
      </View>

      <View style={styles.bottom}>
        <Text style={styles.title}>{'Smart\nPet Care'}</Text>
        <Text style={styles.desc}>All your pet's needs, made smarter and easier: vets, grooming, boarding and training in one place.</Text>

        <View style={styles.controls}>
          <SlideToStart label="Let's Go" onComplete={() => navigation.navigate('Login')} testID="slide-start" />
        </View>

        <TouchableOpacity style={styles.login} onPress={() => navigation.navigate('Login')}>
          <Text style={styles.loginText}>Already have an account? <Text style={styles.loginBold}>Log in</Text></Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  hero: { height: '52%', overflow: 'hidden', alignItems: 'center', justifyContent: 'flex-end' },
  blob: { position: 'absolute', borderRadius: 999, backgroundColor: colors.mintDark },
  brand: { position: 'absolute', top: 54, left: 24, fontSize: 24, fontWeight: '800', color: colors.primary },
  brandSoft: { backgroundColor: '#FFFFFF', color: colors.primary },
  bottom: { flex: 1, paddingHorizontal: 24, paddingTop: 22 },
  title: { fontSize: 46, fontWeight: '500', color: colors.primary, lineHeight: 52, letterSpacing: -1 },
  desc: { fontSize: 15, color: colors.textSecondary, marginTop: 12, lineHeight: 22, maxWidth: 330 },
  controls: { flexDirection: 'row', alignItems: 'center', marginTop: 'auto' },
  login: { alignItems: 'center', paddingVertical: 16 },
  loginText: { fontSize: 14, color: colors.textSecondary },
  loginBold: { fontWeight: '800', color: colors.primary },
});
