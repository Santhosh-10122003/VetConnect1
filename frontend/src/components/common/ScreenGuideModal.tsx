import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { ScreenGuideMockup } from './ScreenGuideMockup';
import { getScreenGuideForRole, ScreenGuideItem } from '../../data/screenGuideData';
import { markGuideSeen } from '../../utils/guideStorage';

interface Props {
  visible: boolean;
  role?: string;
  userId?: number | string;
  onClose: () => void;
  onNavigateToScreen?: (target: { screen: string; tab?: string }) => void;
  onOpenFullGuide?: () => void;
}

export const ScreenGuideModal: React.FC<Props> = ({
  visible,
  role = 'ROLE_CUSTOMER',
  userId,
  onClose,
  onNavigateToScreen,
  onOpenFullGuide,
}) => {
  const { height } = useWindowDimensions();
  const guideItems = getScreenGuideForRole(role);
  const [currentIndex, setCurrentIndex] = useState(0);

  const currentItem: ScreenGuideItem = guideItems[currentIndex] || guideItems[0];
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === guideItems.length - 1;

  const handleFinish = async () => {
    if (userId) {
      await markGuideSeen(userId);
    }
    onClose();
  };

  const handleNext = () => {
    if (isLast) {
      handleFinish();
    } else {
      setCurrentIndex((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    if (!isFirst) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  const handleJumpToScreen = async () => {
    if (userId) {
      await markGuideSeen(userId);
    }
    onClose();
    if (currentItem.navigationTarget && onNavigateToScreen) {
      onNavigateToScreen(currentItem.navigationTarget);
    }
  };

  if (!visible || guideItems.length === 0) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={handleFinish}>
      <View style={styles.backdrop}>
        <View style={[styles.modalCard, { maxHeight: Math.min(height * 0.9, 720) }]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={[styles.iconCircle, { backgroundColor: currentItem.color }]}>
                <Ionicons name={currentItem.icon} size={22} color="#FFFFFF" />
              </View>
              <View>
                <Text style={styles.appTitle}>Jenni Screen Guide</Text>
                <Text style={styles.stepCounter}>
                  Step {currentIndex + 1} of {guideItems.length}
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={handleFinish} style={styles.closeBtn} testID="guide-skip-button">
              <Text style={styles.skipText}>Skip</Text>
              <Ionicons name="close" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Progress Indicators */}
          <View style={styles.progressRow}>
            {guideItems.map((_, idx) => (
              <TouchableOpacity
                key={idx}
                onPress={() => setCurrentIndex(idx)}
                style={[
                  styles.progressSegment,
                  idx === currentIndex
                    ? [styles.progressSegmentActive, { backgroundColor: currentItem.color }]
                    : idx < currentIndex
                    ? styles.progressSegmentDone
                    : styles.progressSegmentPending,
                ]}
              />
            ))}
          </View>

          {/* Main Content Area */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            bounces={false}
          >
            {/* Badge & Title */}
            <View style={styles.badgeRow}>
              <Text style={[styles.badgeText, { color: currentItem.color }]}>{currentItem.badge}</Text>
            </View>
            <Text style={styles.title}>{currentItem.title}</Text>
            <Text style={styles.subtitle}>{currentItem.subtitle}</Text>

            {/* Visual Screen Mockup */}
            <ScreenGuideMockup type={currentItem.mockType} />

            {/* Description */}
            <Text style={styles.description}>{currentItem.description}</Text>

            {/* Easy Highlights */}
            <View style={styles.sectionBox}>
              <Text style={styles.sectionHeader}>What you can do here:</Text>
              {currentItem.easyHighlights.map((hl, i) => (
                <View key={i} style={styles.highlightRow}>
                  <Ionicons name="checkmark-circle" size={16} color={currentItem.color} style={{ marginTop: 2 }} />
                  <Text style={styles.highlightText}>{hl}</Text>
                </View>
              ))}
            </View>

            {/* Easy Tip */}
            <View style={styles.tipCard}>
              <Text style={styles.tipText}>{currentItem.easyTip}</Text>
            </View>

            {/* Try screen button */}
            {currentItem.navigationTarget && (
              <TouchableOpacity style={styles.jumpBtn} onPress={handleJumpToScreen} activeOpacity={0.85}>
                <Ionicons name="arrow-forward-circle-outline" size={18} color={colors.primaryLight} />
                <Text style={styles.jumpBtnText}>Go to {currentItem.screenName} now</Text>
              </TouchableOpacity>
            )}
          </ScrollView>

          {/* Bottom Navigation Buttons */}
          <View style={styles.footer}>
            <TouchableOpacity
              onPress={handleBack}
              disabled={isFirst}
              style={[styles.backBtn, isFirst && styles.btnDisabled]}
              activeOpacity={0.8}
            >
              <Ionicons name="chevron-back" size={18} color={isFirst ? colors.textMuted : colors.text} />
              <Text style={[styles.backBtnText, isFirst && { color: colors.textMuted }]}>Back</Text>
            </TouchableOpacity>

            {onOpenFullGuide && (
              <TouchableOpacity onPress={() => { handleFinish(); onOpenFullGuide(); }} style={styles.allScreensBtn}>
                <Ionicons name="grid-outline" size={15} color={colors.textSecondary} />
                <Text style={styles.allScreensText}>All Screens</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={handleNext}
              style={[styles.nextBtn, { backgroundColor: currentItem.color }]}
              activeOpacity={0.85}
              testID="guide-next-button"
            >
              <Text style={styles.nextBtnText}>{isLast ? 'Got it, let’s go!' : 'Next'}</Text>
              <Ionicons name={isLast ? 'checkmark' : 'chevron-forward'} size={18} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    paddingTop: 16,
    paddingBottom: 14,
    paddingHorizontal: 18,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.primary,
  },
  stepCounter: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  closeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 6,
    gap: 2,
  },
  skipText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  progressRow: {
    flexDirection: 'row',
    gap: 5,
    marginBottom: 14,
  },
  progressSegment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  progressSegmentActive: {
    height: 4,
  },
  progressSegmentDone: {
    backgroundColor: colors.mintDark,
  },
  progressSegmentPending: {
    backgroundColor: '#E2E8F0',
  },
  scrollContent: {
    paddingBottom: 10,
  },
  badgeRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
    marginBottom: 4,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.text,
    marginVertical: 6,
  },
  sectionBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    marginVertical: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  highlightRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 6,
  },
  highlightText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: colors.text,
  },
  tipCard: {
    backgroundColor: colors.mint,
    borderRadius: 12,
    padding: 10,
    marginVertical: 6,
    borderWidth: 1,
    borderColor: colors.mintBorder,
  },
  tipText: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.primary,
    fontWeight: '600',
  },
  jumpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    marginTop: 4,
  },
  jumpBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primaryLight,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E2E8F0',
    gap: 10,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 4,
  },
  backBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  btnDisabled: {
    opacity: 0.4,
  },
  allScreensBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  allScreensText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 10,
    gap: 6,
  },
  nextBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});

