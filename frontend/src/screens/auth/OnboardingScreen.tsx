import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, useWindowDimensions } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { AuthStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'Onboarding'>;

const slides = [
  { pet: '🐱', title: 'Smart\nPet Care', desc: 'All your pet\'s needs, made smarter and easier.' },
  { pet: '🐶', title: 'Trusted\nVet Visits', desc: 'Find verified veterinarians near you and book a slot in seconds.' },
  { pet: '🐰', title: 'Pamper\nYour Pet', desc: 'Grooming, boarding and training from people who love animals.' },
];

/** A big pale-sky shape with the pet on it, bold black words below and a black pill to continue. */
export const OnboardingScreen: React.FC<Props> = ({ navigation }) => {
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const slide = slides[index];
  const last = index === slides.length - 1;

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
        <Text style={styles.pet}>{slide.pet}</Text>
        <TouchableOpacity style={styles.skip} onPress={() => navigation.navigate('Login')}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.bottom}>
        <View style={styles.dashes}>
          {slides.map((_, i) => <View key={i} style={[styles.dash, i === index && styles.dashActive]} />)}
        </View>
        <Text style={styles.title}>{slide.title}</Text>
        <Text style={styles.desc}>{slide.desc}</Text>

        <View style={styles.controls}>
          <TouchableOpacity style={styles.back} onPress={() => setIndex((i) => Math.max(0, i - 1))} disabled={index === 0} activeOpacity={0.8}>
            <Ionicons name="arrow-back" size={22} color={index === 0 ? colors.textMuted : colors.text} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.pill} activeOpacity={0.9} onPress={() => (last ? navigation.navigate('Login') : setIndex(index + 1))}>
            <View style={styles.pillIcon}><Ionicons name="paw" size={20} color={colors.primary} /></View>
            <Text style={styles.pillText}>{last ? 'Let\'s Go' : 'Next'}</Text>
            <Ionicons name="chevron-forward" size={18} color="#6B7280" />
            <Ionicons name="chevron-forward" size={18} color="#FFFFFF" style={{ marginLeft: -10 }} />
          </TouchableOpacity>
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
  hero: { height: '46%', overflow: 'hidden', alignItems: 'center', justifyContent: 'flex-end' },
  blob: { position: 'absolute', borderRadius: 999, backgroundColor: colors.mintDark },
  brand: { position: 'absolute', top: 54, left: 24, fontSize: 24, fontWeight: '800', color: colors.primary },
  brandSoft: { backgroundColor: '#FFFFFF', color: colors.primary },
  pet: { fontSize: 150, marginBottom: 6 },
  skip: { position: 'absolute', bottom: 16, right: 20, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16, backgroundColor: '#FFFFFF' },
  skipText: { fontSize: 13, fontWeight: '700', color: colors.primary },
  bottom: { flex: 1, paddingHorizontal: 24, paddingTop: 18 },
  dashes: { flexDirection: 'row', gap: 6, marginBottom: 14 },
  dash: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#E5E7EB' },
  dashActive: { width: 34, backgroundColor: colors.primary },
  title: { fontSize: 44, fontWeight: '500', color: colors.primary, lineHeight: 50, letterSpacing: -1 },
  desc: { fontSize: 15, color: colors.textSecondary, marginTop: 10, lineHeight: 22, maxWidth: 320 },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 'auto' },
  back: { width: 58, height: 58, borderRadius: 29, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  pill: { flex: 1, height: 58, borderRadius: 29, backgroundColor: '#14171C', flexDirection: 'row', alignItems: 'center', paddingLeft: 5, paddingRight: 18, gap: 14 },
  pillIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.mintDark, alignItems: 'center', justifyContent: 'center' },
  pillText: { flex: 1, color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  login: { alignItems: 'center', paddingVertical: 16 },
  loginText: { fontSize: 14, color: colors.textSecondary },
  loginBold: { fontWeight: '800', color: colors.primary },
});
