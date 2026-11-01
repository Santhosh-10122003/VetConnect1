import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Animated,
  Easing,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { clearNewUserRegistered, markGuideSeen } from '../../utils/guideStorage';

export interface StoryScreenData {
  id: string;
  tabKey: 'Home' | 'FindDoctors' | 'Appointments' | 'PetCare' | 'Pets' | 'Profile';
  badge: string;
  screenTitle: string;
  tagline: string;
  description: string;
  easyTip: string;
  accentColor: string;
  icon: keyof typeof Ionicons.glyphMap;
  demoType: 'home' | 'doctors' | 'visits' | 'care' | 'pets' | 'profile';
}

const STORIES: StoryScreenData[] = [
  {
    id: 'story-home',
    tabKey: 'Home',
    badge: 'SCREEN 1 OF 6',
    screenTitle: 'Home Hub',
    tagline: 'Your central command center',
    description: 'Tap tiles to instantly book vets, grooming & boarding, or check live countdowns for upcoming visits.',
    easyTip: '💡 Tap any service tile on Home to skip searching and book directly.',
    accentColor: '#0EA5E9',
    icon: 'home',
    demoType: 'home',
  },
  {
    id: 'story-doctors',
    tabKey: 'FindDoctors',
    badge: 'SCREEN 2 OF 6',
    screenTitle: 'Find Doctors',
    tagline: 'Nearby verified veterinarians',
    description: 'Discover verified clinics within 25 km, check consult fees & degrees, and get turn-by-turn map directions.',
    easyTip: '💡 Pinned location calculates exact road distances to nearby vets.',
    accentColor: '#10B981',
    icon: 'medkit',
    demoType: 'doctors',
  },
  {
    id: 'story-visits',
    tabKey: 'Appointments',
    badge: 'SCREEN 3 OF 6',
    screenTitle: 'Visits & Slots',
    tagline: 'Manage appointments & Rx',
    description: 'Pay just 50% advance to lock your 15-minute held slot. Request reschedules & view digital prescriptions.',
    easyTip: '💡 100% automatic refund if you cancel at least 24 hours prior.',
    accentColor: '#F59E0B',
    icon: 'calendar',
    demoType: 'visits',
  },
  {
    id: 'story-care',
    tabKey: 'PetCare',
    badge: 'SCREEN 4 OF 6',
    screenTitle: 'Pet Care',
    tagline: 'Grooming, boarding & training',
    description: 'Pamper your pets with trusted local centers. Choose services with transparent pricing tailored to your pet size.',
    easyTip: '💡 Pick start & end dates for overnight boarding with live capacity checks.',
    accentColor: '#8B5CF6',
    icon: 'cut',
    demoType: 'care',
  },
  {
    id: 'story-pets',
    tabKey: 'Pets',
    badge: 'SCREEN 5 OF 6',
    screenTitle: 'My Pets',
    tagline: 'Health records & profiles',
    description: 'Add your pets once: store vaccines, breed, age & allergies for instant 1-tap checkout during bookings.',
    easyTip: '💡 Save your pet before booking so the vet receives their health records.',
    accentColor: '#EC4899',
    icon: 'paw',
    demoType: 'pets',
  },
  {
    id: 'story-profile',
    tabKey: 'Profile',
    badge: 'SCREEN 6 OF 6',
    screenTitle: 'Profile & Safety',
    tagline: 'GPS pin & 24x7 emergency',
    description: 'Pin your home GPS coordinates for nearby clinic discovery, update emergency contacts & call 24x7 hotlines.',
    easyTip: '💡 Emergency helplines are available 24x7 under Help & Support.',
    accentColor: '#6366F1',
    icon: 'location',
    demoType: 'profile',
  },
];

const STORY_DURATION = 5500; // 5.5 seconds per story

interface Props {
  visible: boolean;
  userId?: number | string;
  onClose: () => void;
  onNavigateToTab?: (tab: string) => void;
}

export const ScreenStoryWalkthrough: React.FC<Props> = ({
  visible,
  userId,
  onClose,
  onNavigateToTab,
}) => {
  const { width } = useWindowDimensions();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  // Story progress bar animations
  const progressAnim = useRef(new Animated.Value(0)).current;

  // Micro-demo animation values
  const floatAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const cardSlideAnim = useRef(new Animated.Value(20)).current;
  const cardFadeAnim = useRef(new Animated.Value(0)).current;

  const currentStory = STORIES[currentIndex] || STORIES[0];
  const isLast = currentIndex === STORIES.length - 1;

  // Story Timer effect
  useEffect(() => {
    if (!visible) return;

    progressAnim.setValue(0);
    const progressAnimation = Animated.timing(progressAnim, {
      toValue: 1,
      duration: STORY_DURATION,
      easing: Easing.linear,
      useNativeDriver: false,
    });

    if (!isPaused) {
      progressAnimation.start(({ finished }) => {
        if (finished) {
          handleNext();
        }
      });
    } else {
      progressAnimation.stop();
    }

    return () => progressAnimation.stop();
  }, [currentIndex, isPaused, visible]);

  // Micro-demo animations per story change
  useEffect(() => {
    if (!visible) return;

    // Entrance slide & fade
    cardSlideAnim.setValue(20);
    cardFadeAnim.setValue(0);
    Animated.parallel([
      Animated.timing(cardSlideAnim, {
        toValue: 0,
        duration: 400,
        easing: Easing.out(Easing.back(1.5)),
        useNativeDriver: true,
      }),
      Animated.timing(cardFadeAnim, {
        toValue: 1,
        duration: 350,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start();

    // Floating loop
    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -6,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );

    // Pulse loop
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.15,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1.0,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    floatLoop.start();
    pulseLoop.start();

    return () => {
      floatLoop.stop();
      pulseLoop.stop();
    };
  }, [currentIndex, visible]);

  const handleFinish = async () => {
    if (userId) {
      await markGuideSeen(userId);
    }
    await clearNewUserRegistered();
    onClose();
  };

  const handleNext = () => {
    if (isLast) {
      handleFinish();
    } else {
      setCurrentIndex((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  const handleExploreScreen = async () => {
    const targetTab = currentStory.tabKey;
    await handleFinish();
    if (onNavigateToTab) {
      onNavigateToTab(targetTab);
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="fade" transparent={false} onRequestClose={handleFinish}>
      <View style={styles.container}>
        {/* Story Progress Bars at Top */}
        <View style={styles.progressContainer}>
          {STORIES.map((s, idx) => {
            let fillStyle;
            if (idx < currentIndex) {
              fillStyle = { width: '100%', backgroundColor: '#FFFFFF' };
            } else if (idx === currentIndex) {
              fillStyle = {
                width: progressAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0%', '100%'],
                }),
                backgroundColor: currentStory.accentColor,
              };
            } else {
              fillStyle = { width: '0%' };
            }

            return (
              <View key={s.id} style={styles.progressBarTrack}>
                <Animated.View style={[styles.progressBarFill, fillStyle]} />
              </View>
            );
          })}
        </View>

        {/* Top Header Bar */}
        <View style={styles.topHeader}>
          <View style={styles.headerBrand}>
            <View style={[styles.avatarCircle, { backgroundColor: currentStory.accentColor }]}>
              <Ionicons name={currentStory.icon} size={18} color="#FFFFFF" />
            </View>
            <View>
              <Text style={styles.brandTitle}>Jenni • {currentStory.screenTitle}</Text>
              <Text style={styles.brandBadge}>{currentStory.badge}</Text>
            </View>
          </View>
          <TouchableOpacity onPress={handleFinish} style={styles.closeBtn} activeOpacity={0.7} testID="story-close-btn">
            <Ionicons name="close" size={26} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Tap areas for Prev / Next story (Instagram style) */}
        <View style={styles.tapNavigationContainer} pointerEvents="box-none">
          <TouchableWithoutFeedback
            onPress={handlePrev}
            onPressIn={() => setIsPaused(true)}
            onPressOut={() => setIsPaused(false)}
          >
            <View style={styles.tapLeft} />
          </TouchableWithoutFeedback>
          <TouchableWithoutFeedback
            onPress={handleNext}
            onPressIn={() => setIsPaused(true)}
            onPressOut={() => setIsPaused(false)}
          >
            <View style={styles.tapRight} />
          </TouchableWithoutFeedback>
        </View>

        {/* Story Body Card with Micro-Demo */}
        <View style={styles.storyContent} pointerEvents="box-none">
          <Animated.View
            style={[
              styles.storyCard,
              {
                opacity: cardFadeAnim,
                transform: [{ translateY: cardSlideAnim }],
              },
            ]}
          >
            {/* Tagline & Title */}
            <Text style={[styles.storyTagline, { color: currentStory.accentColor }]}>
              {currentStory.tagline}
            </Text>
            <Text style={styles.storyHeading}>{currentStory.screenTitle}</Text>

            {/* Interactive Micro-Demo View */}
            <View style={styles.demoContainer}>
              {renderMicroDemo(currentStory.demoType, currentStory.accentColor, floatAnim, pulseAnim)}
            </View>

            {/* Short Crisp Description */}
            <Text style={styles.storyDescription}>{currentStory.description}</Text>

            {/* Pro Tip Card */}
            <View style={[styles.tipBox, { borderColor: `${currentStory.accentColor}40` }]}>
              <Text style={styles.tipText}>{currentStory.easyTip}</Text>
            </View>

            {/* Action CTA Button */}
            <TouchableOpacity
              style={[styles.ctaButton, { backgroundColor: currentStory.accentColor }]}
              onPress={isLast ? handleFinish : handleExploreScreen}
              activeOpacity={0.85}
              testID="story-action-btn"
            >
              <Text style={styles.ctaButtonText}>
                {isLast ? 'Start Exploring 🐾' : `Explore ${currentStory.screenTitle} ➔`}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </View>

        {/* Bottom Story Hint */}
        <View style={styles.bottomHintBar} pointerEvents="none">
          <Text style={styles.hintText}>Tap right to continue • Hold to pause</Text>
        </View>
      </View>
    </Modal>
  );
};

// -------------------------------------------------------------------------------------------------
// Interactive Animated Micro-Demos for Each Screen
// -------------------------------------------------------------------------------------------------
function renderMicroDemo(
  type: StoryScreenData['demoType'],
  accentColor: string,
  floatAnim: Animated.Value,
  pulseAnim: Animated.Value
) {
  switch (type) {
    case 'home':
      return (
        <View style={demoStyles.box}>
          <Animated.View style={[demoStyles.searchMock, { transform: [{ translateY: floatAnim }] }]}>
            <Ionicons name="search" size={16} color={accentColor} />
            <Text style={demoStyles.searchText}>Search certified vets nearby...</Text>
          </Animated.View>
          <View style={demoStyles.tilesRow}>
            {[
              { label: 'Vet', icon: 'medkit-outline' },
              { label: 'Grooming', icon: 'cut-outline' },
              { label: 'Boarding', icon: 'bed-outline' },
              { label: 'My Pets', icon: 'paw-outline' },
            ].map((t, i) => (
              <View key={i} style={[demoStyles.miniTile, i === 0 && { borderColor: accentColor, borderWidth: 1.5 }]}>
                <Ionicons name={t.icon as any} size={18} color={i === 0 ? accentColor : '#CBD5E1'} />
                <Text style={[demoStyles.tileText, i === 0 && { color: '#FFFFFF', fontWeight: '800' }]}>{t.label}</Text>
              </View>
            ))}
          </View>
          <View style={demoStyles.nextVisitMock}>
            <View style={{ flex: 1 }}>
              <Text style={demoStyles.visitTitle}>Next Consultation</Text>
              <Text style={demoStyles.visitSub}>Dr. Sarah • Tomorrow 10:30 AM</Text>
            </View>
            <View style={[demoStyles.chipConfirmed, { backgroundColor: `${accentColor}25` }]}>
              <Text style={[demoStyles.chipText, { color: accentColor }]}>CONFIRMED</Text>
            </View>
          </View>
        </View>
      );

    case 'doctors':
      return (
        <View style={demoStyles.box}>
          <View style={demoStyles.docCardMock}>
            <Animated.View style={[demoStyles.radarCircle, { transform: [{ scale: pulseAnim }], borderColor: accentColor }]}>
              <Ionicons name="navigate" size={20} color={accentColor} />
            </Animated.View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={demoStyles.docName}>Dr. Sarah Adams</Text>
                <Ionicons name="checkmark-circle" size={16} color={accentColor} />
              </View>
              <Text style={demoStyles.docMeta}>8 yrs exp • ★ 4.9 • 2.4 km away</Text>
              <View style={demoStyles.tagRow}>
                <View style={demoStyles.miniBadge}><Text style={demoStyles.miniBadgeText}>50% Advance</Text></View>
                <View style={demoStyles.miniBadge}><Text style={demoStyles.miniBadgeText}>Open Today</Text></View>
              </View>
            </View>
          </View>
          <Animated.View style={[demoStyles.mapBtnMock, { transform: [{ translateY: floatAnim }] }]}>
            <Ionicons name="map-outline" size={15} color="#FFFFFF" />
            <Text style={demoStyles.mapBtnText}>1-Tap Clinic Map & Directions</Text>
          </Animated.View>
        </View>
      );

    case 'visits':
      return (
        <View style={demoStyles.box}>
          <View style={demoStyles.ticketMock}>
            <View style={demoStyles.ticketLeft}>
              <Text style={demoStyles.ticketHeader}>SLOT HOLD</Text>
              <Text style={demoStyles.ticketTime}>15:00</Text>
              <Text style={demoStyles.ticketSub}>Safe Hold</Text>
            </View>
            <View style={demoStyles.ticketDivider} />
            <View style={{ flex: 1, paddingLeft: 12 }}>
              <Text style={demoStyles.ticketTitle}>Annual Health Checkup</Text>
              <Text style={demoStyles.ticketMeta}>50% advance online • 50% at clinic</Text>
              <View style={demoStyles.badgeRefundRow}>
                <Ionicons name="shield-checkmark" size={14} color="#10B981" />
                <Text style={demoStyles.refundText}>100% Refundable if canceled 24h prior</Text>
              </View>
            </View>
          </View>
        </View>
      );

    case 'care':
      return (
        <View style={demoStyles.box}>
          <View style={demoStyles.sizeGridMock}>
            {[
              { size: 'Small', kg: '≤ 7 kg', price: '₹499', on: false },
              { size: 'Medium', kg: '≤ 20 kg', price: '₹799', on: true },
              { size: 'Large', kg: '≤ 35 kg', price: '₹1,099', on: false },
            ].map((s, i) => (
              <View key={i} style={[demoStyles.sizeCard, s.on && { borderColor: accentColor, backgroundColor: `${accentColor}18` }]}>
                <Text style={[demoStyles.sizeTitle, s.on && { color: accentColor }]}>{s.size}</Text>
                <Text style={demoStyles.sizeWeight}>{s.kg}</Text>
                <Text style={[demoStyles.sizePrice, s.on && { color: '#FFFFFF' }]}>{s.price}</Text>
              </View>
            ))}
          </View>
          <Animated.View style={[demoStyles.spaPill, { transform: [{ translateY: floatAnim }] }]}>
            <Ionicons name="sparkles" size={14} color={accentColor} />
            <Text style={demoStyles.spaPillText}>Grooming • Overnight Boarding • Training</Text>
          </Animated.View>
        </View>
      );

    case 'pets':
      return (
        <View style={demoStyles.box}>
          <Animated.View style={[demoStyles.petCardMock, { transform: [{ translateY: floatAnim }] }]}>
            <View style={[demoStyles.petAvatar, { backgroundColor: accentColor }]}>
              <Ionicons name="paw" size={24} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={demoStyles.petName}>Bella</Text>
              <Text style={demoStyles.petBreed}>Golden Retriever • Female • 2 yrs</Text>
              <View style={demoStyles.healthRow}>
                <View style={demoStyles.vaccineChip}>
                  <Text style={demoStyles.vaccineText}>✓ Vaccines Up to Date</Text>
                </View>
              </View>
            </View>
          </Animated.View>
          <View style={demoStyles.fastBookingPill}>
            <Ionicons name="flash" size={14} color={accentColor} />
            <Text style={demoStyles.fastBookingText}>Auto-fills medical records at checkout</Text>
          </View>
        </View>
      );

    case 'profile':
      return (
        <View style={demoStyles.box}>
          <View style={demoStyles.safetyCardMock}>
            <View style={demoStyles.safetyRow}>
              <Ionicons name="location" size={20} color={accentColor} />
              <View style={{ flex: 1 }}>
                <Text style={demoStyles.safetyTitle}>GPS Pinned Location</Text>
                <Text style={demoStyles.safetySub}>Calculates accurate clinic radius</Text>
              </View>
            </View>
            <View style={demoStyles.safetyDivider} />
            <View style={demoStyles.safetyRow}>
              <Ionicons name="call" size={20} color="#EF4444" />
              <View style={{ flex: 1 }}>
                <Text style={demoStyles.safetyTitle}>24x7 Poison & Emergency Hotlines</Text>
                <Text style={demoStyles.safetySub}>Direct instant emergency calls</Text>
              </View>
            </View>
          </View>
        </View>
      );

    default:
      return null;
  }
}

// -------------------------------------------------------------------------------------------------
// Styles
// -------------------------------------------------------------------------------------------------
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090D16',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 54 : 36,
    paddingBottom: 20,
  },
  progressContainer: {
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  progressBarTrack: {
    flex: 1,
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    marginBottom: 8,
    zIndex: 10,
  },
  headerBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatarCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  brandBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.5,
  },
  closeBtn: {
    padding: 6,
  },
  tapNavigationContainer: {
    position: 'absolute',
    top: 90,
    left: 0,
    right: 0,
    bottom: 90,
    flexDirection: 'row',
    zIndex: 5,
  },
  tapLeft: {
    width: '32%',
    height: '100%',
  },
  tapRight: {
    width: '68%',
    height: '100%',
  },
  storyContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 18,
    zIndex: 8,
  },
  storyCard: {
    width: '100%',
    backgroundColor: '#131B2E',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 12,
  },
  storyTagline: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  storyHeading: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.4,
    marginTop: 2,
    marginBottom: 14,
  },
  demoContainer: {
    marginVertical: 4,
  },
  storyDescription: {
    fontSize: 14,
    lineHeight: 20,
    color: '#CBD5E1',
    marginTop: 12,
    marginBottom: 10,
  },
  tipBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    marginBottom: 16,
  },
  tipText: {
    fontSize: 12,
    color: '#E2E8F0',
    lineHeight: 16,
    fontWeight: '500',
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 14,
    gap: 8,
  },
  ctaButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  bottomHintBar: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  hintText: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.4)',
    fontWeight: '500',
  },
});

const demoStyles = StyleSheet.create({
  box: {
    backgroundColor: '#0F172A',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    gap: 10,
  },
  searchMock: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 8,
  },
  searchText: { fontSize: 12, color: '#94A3B8' },
  tilesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
  },
  miniTile: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 8,
    gap: 3,
  },
  tileText: { fontSize: 10, color: '#94A3B8', fontWeight: '600' },
  nextVisitMock: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 10,
    padding: 10,
  },
  visitTitle: { fontSize: 11, fontWeight: '700', color: '#FFFFFF' },
  visitSub: { fontSize: 10, color: '#94A3B8', marginTop: 1 },
  chipConfirmed: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  chipText: { fontSize: 9, fontWeight: '800' },
  docCardMock: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 12,
  },
  radarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  docName: { fontSize: 13, fontWeight: '800', color: '#FFFFFF' },
  docMeta: { fontSize: 11, color: '#94A3B8', marginTop: 2 },
  tagRow: { flexDirection: 'row', gap: 6, marginTop: 5 },
  miniBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  miniBadgeText: { fontSize: 9, color: '#CBD5E1', fontWeight: '600' },
  mapBtnMock: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563EB',
    borderRadius: 10,
    paddingVertical: 8,
    gap: 6,
  },
  mapBtnText: { fontSize: 11, fontWeight: '700', color: '#FFFFFF' },
  ticketMock: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 12,
  },
  ticketLeft: {
    alignItems: 'center',
    paddingRight: 10,
  },
  ticketHeader: { fontSize: 9, fontWeight: '800', color: '#F59E0B' },
  ticketTime: { fontSize: 16, fontWeight: '900', color: '#FFFFFF' },
  ticketSub: { fontSize: 9, color: '#94A3B8' },
  ticketDivider: { width: 1, height: 36, backgroundColor: 'rgba(255,255,255,0.1)' },
  ticketTitle: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },
  ticketMeta: { fontSize: 10, color: '#94A3B8', marginTop: 2 },
  badgeRefundRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 5 },
  refundText: { fontSize: 10, color: '#10B981', fontWeight: '600' },
  sizeGridMock: {
    flexDirection: 'row',
    gap: 6,
  },
  sizeCard: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 10,
    padding: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  sizeTitle: { fontSize: 11, fontWeight: '700', color: '#CBD5E1' },
  sizeWeight: { fontSize: 9, color: '#94A3B8', marginTop: 1 },
  sizePrice: { fontSize: 11, fontWeight: '800', color: '#94A3B8', marginTop: 4 },
  spaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 10,
    paddingVertical: 6,
    gap: 6,
  },
  spaPillText: { fontSize: 10, fontWeight: '600', color: '#CBD5E1' },
  petCardMock: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 12,
    gap: 12,
  },
  petAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  petName: { fontSize: 14, fontWeight: '800', color: '#FFFFFF' },
  petBreed: { fontSize: 11, color: '#94A3B8', marginTop: 1 },
  healthRow: { flexDirection: 'row', marginTop: 4 },
  vaccineChip: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  vaccineText: { fontSize: 9, fontWeight: '700', color: '#10B981' },
  fastBookingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
  },
  fastBookingText: { fontSize: 10, fontWeight: '600', color: '#94A3B8' },
  safetyCardMock: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  safetyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  safetyTitle: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },
  safetySub: { fontSize: 10, color: '#94A3B8', marginTop: 1 },
  safetyDivider: { height: 1, backgroundColor: 'rgba(255, 255, 255, 0.08)' },
});

