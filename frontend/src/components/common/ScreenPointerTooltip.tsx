import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { TourStepData } from '../../context/ScreenTourContext';

interface Props {
  step: TourStepData;
  onNext: () => void;
  onSkip: () => void;
}

export const ScreenPointerTooltip: React.FC<Props> = ({ step, onNext, onSkip }) => {
  const { width } = useWindowDimensions();

  // Animations
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseOpacity = useRef(new Animated.Value(0.7)).current;
  const bounceAnim = useRef(new Animated.Value(0)).current;
  const cardFade = useRef(new Animated.Value(0)).current;
  const cardSlide = useRef(new Animated.Value(18)).current;

  // Pulse animation loop
  useEffect(() => {
    const pulseLoop = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.4,
            duration: 900,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1.0,
            duration: 100,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(pulseOpacity, {
            toValue: 0,
            duration: 900,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseOpacity, {
            toValue: 0.7,
            duration: 100,
            useNativeDriver: true,
          }),
        ]),
      ])
    );

    // Arrow bounce loop
    const bounceLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(bounceAnim, {
          toValue: -8,
          duration: 500,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(bounceAnim, {
          toValue: 0,
          duration: 500,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );

    pulseLoop.start();
    bounceLoop.start();

    return () => {
      pulseLoop.stop();
      bounceLoop.stop();
    };
  }, [pulseAnim, pulseOpacity, bounceAnim]);

  // Card slide & fade in whenever step changes
  useEffect(() => {
    cardFade.setValue(0);
    cardSlide.setValue(18);

    Animated.parallel([
      Animated.timing(cardFade, {
        toValue: 1,
        duration: 350,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(cardSlide, {
        toValue: 0,
        duration: 350,
        easing: Easing.out(Easing.back(1.5)),
        useNativeDriver: true,
      }),
    ]).start();
  }, [step.id, cardFade, cardSlide]);

  const isLast = step.stepNumber === step.totalSteps;

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      {/* Background Dim Backdrop */}
      <View style={styles.dimLayer} pointerEvents="none" />

      {/* Pointed-out Animated Icon Beacon */}
      <View style={styles.beaconContainer}>
        {/* Pulsing ring */}
        <Animated.View
          style={[
            styles.pulseRing,
            {
              backgroundColor: step.iconColor,
              transform: [{ scale: pulseAnim }],
              opacity: pulseOpacity,
            },
          ]}
        />

        {/* Main circular icon badge */}
        <View style={[styles.iconCircle, { backgroundColor: step.iconColor }]}>
          <Ionicons name={step.icon as any} size={28} color="#FFFFFF" />
        </View>

        {/* Bouncing pointer arrow pointing down */}
        <Animated.View style={[styles.pointerArrow, { transform: [{ translateY: bounceAnim }] }]}>
          <Ionicons name="arrow-down" size={24} color={step.iconColor} />
        </Animated.View>
      </View>

      {/* Animated Small Description Card */}
      <Animated.View
        style={[
          styles.card,
          {
            width: Math.min(width - 36, 360),
            opacity: cardFade,
            transform: [{ translateY: cardSlide }],
          },
        ]}
      >
        {/* Card Header with Step pill and Skip button */}
        <View style={styles.cardHeader}>
          <View style={[styles.stepPill, { backgroundColor: colors.mint }]}>
            <Text style={[styles.stepPillText, { color: step.iconColor }]}>
              🐾 Step {step.stepNumber} of {step.totalSteps}
            </Text>
          </View>
          <TouchableOpacity onPress={onSkip} style={styles.skipBtn} activeOpacity={0.7} testID="tour-skip-btn">
            <Text style={styles.skipBtnText}>Skip Tour</Text>
          </TouchableOpacity>
        </View>

        {/* Short title */}
        <Text style={styles.cardTitle}>{step.title}</Text>

        {/* Small concise description */}
        <Text style={styles.cardDesc}>{step.description}</Text>

        {/* Action button */}
        <View style={styles.cardFooter}>
          <TouchableOpacity
            style={[styles.nextBtn, { backgroundColor: step.iconColor }]}
            onPress={onNext}
            activeOpacity={0.85}
            testID="tour-next-btn"
          >
            <Text style={styles.nextBtnText}>
              {isLast ? 'Got it, let’s explore! 🎉' : `Next Screen 👉`}
            </Text>
            <Ionicons name={isLast ? 'checkmark-circle' : 'arrow-forward'} size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dimLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  beaconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  pulseRing: {
    position: 'absolute',
    width: 74,
    height: 74,
    borderRadius: 37,
  },
  iconCircle: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  pointerArrow: {
    marginTop: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 14,
    elevation: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  stepPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  stepPillText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  skipBtn: {
    padding: 4,
  },
  skipBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.2,
  },
  cardDesc: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary,
    marginTop: 6,
    marginBottom: 14,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 14,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  nextBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
