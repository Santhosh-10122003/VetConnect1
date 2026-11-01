import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing, TouchableWithoutFeedback } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { AuthStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'Splash'>;

const NAME = 'Jenni'.split('');
const INTRO_MS = 3400;

const rise = (v: Animated.Value, delay: number) =>
  Animated.timing(v, { toValue: 1, duration: 520, delay, easing: Easing.out(Easing.cubic), useNativeDriver: false });

/** The first thing people see: the logo pops in, the name types itself out letter by letter, then what the app is for. */
export const SplashScreen: React.FC<Props> = ({ navigation }) => {
  const blobs = useRef(new Animated.Value(0)).current;
  const logo = useRef(new Animated.Value(0)).current;
  const letters = useRef(NAME.map(() => new Animated.Value(0))).current;
  const tagline = useRef(new Animated.Value(0)).current;
  const about = useRef(new Animated.Value(0)).current;
  const dots = useRef(new Animated.Value(0)).current;
  const paws = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(blobs, { toValue: 1, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
      Animated.spring(logo, { toValue: 1, friction: 5, tension: 70, useNativeDriver: false }),
      Animated.stagger(110, letters.map((l, i) => rise(l, 450 + i * 0))),
      rise(tagline, 1150),
      rise(about, 1500),
      ...paws.map((p, i) => Animated.spring(p, { toValue: 1, friction: 4, tension: 60, delay: 700 + i * 160, useNativeDriver: false })),
    ]).start();
    const pulse = Animated.loop(Animated.sequence([
      Animated.timing(dots, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
      Animated.timing(dots, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
    ]));
    pulse.start();
    const timer = setTimeout(() => navigation.replace('Onboarding'), INTRO_MS);
    return () => { clearTimeout(timer); pulse.stop(); };
  }, [navigation, blobs, logo, letters, tagline, about, dots, paws]);

  const grow = blobs.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] });

  return (
    <TouchableWithoutFeedback onPress={() => navigation.replace('Onboarding')}>
      <View style={styles.container} testID="splash">
        <Animated.View style={[styles.blob, { top: -90, right: -70, width: 260, height: 260, opacity: blobs, transform: [{ scale: grow }] }]} />
        <Animated.View style={[styles.blob, { bottom: -110, left: -80, width: 300, height: 300, opacity: blobs, transform: [{ scale: grow }] }]} />

        <View style={styles.logoWrap}>
          {paws.map((p, i) => (
            <Animated.View
              key={i}
              style={[styles.paw, PAW_POS[i], { opacity: p, transform: [{ scale: p }, { rotate: PAW_POS[i].rot }] }]}
            >
              <Ionicons name="paw" size={PAW_POS[i].size} color={colors.secondary} />
            </Animated.View>
          ))}
          <Animated.View style={[styles.logoCircle, { opacity: logo, transform: [{ scale: logo }, { rotate: logo.interpolate({ inputRange: [0, 1], outputRange: ['-25deg', '0deg'] }) }] }]}>
            <Ionicons name="paw" size={56} color="#FFFFFF" />
          </Animated.View>
        </View>

        <View style={styles.nameRow}>
          {NAME.map((ch, i) => (
            <Animated.Text
              key={i}
              style={[styles.appName, { opacity: letters[i], transform: [{ translateY: letters[i].interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }] }]}
            >
              {ch}
            </Animated.Text>
          ))}
        </View>

        <Animated.Text style={[styles.tagline, { opacity: tagline, transform: [{ translateY: tagline.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }]}>
          Smart pet care, all in one place.
        </Animated.Text>
        <Animated.Text style={[styles.about, { opacity: about, transform: [{ translateY: about.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }]}>
          Book a vet, grooming, boarding or training for your pet, pay your advance securely and keep every visit in one app.
        </Animated.Text>

        <View style={styles.dots}>
          {[0, 1, 2].map((i) => (
            <Animated.View
              key={i}
              style={[styles.dot, { opacity: dots.interpolate({ inputRange: [0, 1], outputRange: i % 2 === 0 ? [0.3, 1] : [1, 0.3] }) }]}
            />
          ))}
        </View>
      </View>
    </TouchableWithoutFeedback>
  );
};

const PAW_POS: { top: number; left?: number; right?: number; size: number; rot: string }[] = [
  { top: -10, right: -44, size: 26, rot: '20deg' },
  { top: 70, left: -52, size: 22, rot: '-18deg' },
  { top: -26, left: -30, size: 18, rot: '-30deg' },
];

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', padding: 24, overflow: 'hidden' },
  blob: { position: 'absolute', borderRadius: 999, backgroundColor: colors.mintDark },
  logoWrap: { marginBottom: 22 },
  paw: { position: 'absolute' },
  logoCircle: { width: 110, height: 110, borderRadius: 55, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  nameRow: { flexDirection: 'row' },
  appName: { fontSize: 46, fontWeight: '800', color: colors.primary, letterSpacing: -0.5 },
  tagline: { fontSize: 16, fontWeight: '700', color: colors.primaryLight, marginTop: 8, textAlign: 'center' },
  about: { fontSize: 14, color: colors.textSecondary, marginTop: 10, textAlign: 'center', lineHeight: 21, maxWidth: 300 },
  dots: { flexDirection: 'row', gap: 8, marginTop: 36 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
});
