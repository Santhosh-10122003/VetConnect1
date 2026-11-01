import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { shared } from '../../theme/shared';
import { AppHeader } from '../../components/common/AppHeader';
import { CustomerStackParamList, CustomerTabParamList } from '../../navigation/types';
import { CUSTOMER_SCREEN_GUIDE, ScreenGuideItem } from '../../data/screenGuideData';
import { ScreenGuideMockup } from '../../components/common/ScreenGuideMockup';
import { ScreenStoryWalkthrough } from '../../components/common/ScreenStoryWalkthrough';
import { useAuth } from '../../context/AuthContext';

type Props = NativeStackScreenProps<CustomerStackParamList, 'AppGuide'>;

type FilterCategory = 'ALL' | 'VET' | 'CARE' | 'ACCOUNT';

export const AppGuideScreen: React.FC<Props> = ({ navigation }) => {
  const { user } = useAuth();
  const [filter, setFilter] = useState<FilterCategory>('ALL');
  const [expandedId, setExpandedId] = useState<string | null>('customer-home');
  const [storyVisible, setStoryVisible] = useState(false);

  const filterItems = (item: ScreenGuideItem) => {
    if (filter === 'ALL') return true;
    if (filter === 'VET') return item.id === 'customer-doctors' || item.id === 'customer-appointments';
    if (filter === 'CARE') return item.id === 'customer-care';
    if (filter === 'ACCOUNT') return item.id === 'customer-pets' || item.id === 'customer-profile' || item.id === 'customer-home';
    return true;
  };

  const handleNavigateToScreen = (target: { screen: string; tab?: string }) => {
    if (target.tab) {
      navigation.navigate('CustomerTabs', {
        screen: target.tab as keyof CustomerTabParamList,
      } as never);
    }
  };

  return (
    <View style={shared.screen}>
      <AppHeader
        title="App Screen Guide"
        showBack
        onBack={() => navigation.goBack()}
        rightAction={{
          icon: 'play-circle-outline',
          onPress: () => setStoryVisible(true),
        }}
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Hero banner */}
        <View style={styles.heroCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroBadge}>INTERACTIVE STORY REEL</Text>
            <Text style={styles.heroTitle}>Master every screen in Jenni</Text>
            <Text style={styles.heroSub}>
              Watch interactive stories with live animated micro-demos for each screen.
            </Text>
          </View>
          <TouchableOpacity
            style={styles.tourBtn}
            onPress={() => setStoryVisible(true)}
            activeOpacity={0.85}
          >
            <Ionicons name="play" size={15} color="#FFFFFF" />
            <Text style={styles.tourBtnText}>Watch Stories</Text>
          </TouchableOpacity>
        </View>

        {/* Category filters */}
        <View style={styles.filtersRow}>
          {(
            [
              ['ALL', 'All Screens'],
              ['VET', 'Vets & Visits'],
              ['CARE', 'Pet Care'],
              ['ACCOUNT', 'Pets & Profile'],
            ] as [FilterCategory, string][]
          ).map(([cat, label]) => {
            const active = filter === cat;
            return (
              <TouchableOpacity
                key={cat}
                style={[styles.filterChip, active && styles.filterChipActive]}
                onPress={() => setFilter(cat)}
                activeOpacity={0.85}
              >
                <Text style={[styles.filterText, active && styles.filterTextActive]}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* List of screens */}
        {CUSTOMER_SCREEN_GUIDE.filter(filterItems).map((item) => {
          const isExpanded = expandedId === item.id;
          return (
            <View key={item.id} style={styles.screenCard}>
              <TouchableOpacity
                style={styles.screenHeader}
                onPress={() => setExpandedId(isExpanded ? null : item.id)}
                activeOpacity={0.9}
              >
                <View style={[styles.screenIconCircle, { backgroundColor: item.color }]}>
                  <Ionicons name={item.icon} size={20} color="#FFFFFF" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.screenBadge, { color: item.color }]}>{item.badge}</Text>
                  <Text style={styles.screenTitle}>{item.title}</Text>
                  <Text style={styles.screenSub}>{item.subtitle}</Text>
                </View>
                <Ionicons
                  name={isExpanded ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>

              {isExpanded && (
                <View style={styles.screenBody}>
                  {/* Visual mockup of the screen */}
                  <ScreenGuideMockup type={item.mockType} />

                  <Text style={styles.screenDesc}>{item.description}</Text>

                  {/* Feature highlights */}
                  <View style={styles.featuresBox}>
                    <Text style={styles.featuresHeading}>Key actions you can take:</Text>
                    {item.easyHighlights.map((hl, i) => (
                      <View key={i} style={styles.featureItem}>
                        <Ionicons name="checkmark-circle-outline" size={16} color={item.color} style={{ marginTop: 2 }} />
                        <Text style={styles.featureText}>{hl}</Text>
                      </View>
                    ))}
                  </View>

                  {/* Easy tip */}
                  <View style={styles.tipBox}>
                    <Text style={styles.tipText}>{item.easyTip}</Text>
                  </View>

                  {/* Action button to jump to this screen */}
                  {item.navigationTarget && (
                    <TouchableOpacity
                      style={[styles.actionBtn, { borderColor: item.color }]}
                      onPress={() => handleNavigateToScreen(item.navigationTarget!)}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="arrow-forward" size={16} color={item.color} />
                      <Text style={[styles.actionBtnText, { color: item.color }]}>
                        Go to {item.screenName}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          );
        })}

        {/* Quick Tips Box */}
        <View style={styles.tipsSection}>
          <Text style={styles.tipsSectionTitle}>4 Easy Habits for New Users</Text>
          <View style={styles.quickTipCard}>
            <View style={styles.tipNumber}><Text style={styles.tipNumText}>1</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.quickTipHeading}>Add your pets first</Text>
              <Text style={styles.quickTipBody}>
                Saving your pet under My Pets makes booking vets and groomers a 1-tap checkout.
              </Text>
            </View>
          </View>

          <View style={styles.quickTipCard}>
            <View style={styles.tipNumber}><Text style={styles.tipNumText}>2</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.quickTipHeading}>Pin your location</Text>
              <Text style={styles.quickTipBody}>
                Jenni calculates real driving distances to clinics. A pinned location shows you the closest vets.
              </Text>
            </View>
          </View>

          <View style={styles.quickTipCard}>
            <View style={styles.tipNumber}><Text style={styles.tipNumText}>3</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.quickTipHeading}>15-Minute Slot Hold</Text>
              <Text style={styles.quickTipBody}>
                When you initiate an appointment, the slot is locked safely for 15 minutes while paying the 50% advance.
              </Text>
            </View>
          </View>

          <View style={styles.quickTipCard}>
            <View style={styles.tipNumber}><Text style={styles.tipNumText}>4</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.quickTipHeading}>100% Refundable</Text>
              <Text style={styles.quickTipBody}>
                Plans change? Cancel at least 24 hours in advance to receive a 100% automatic refund.
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Interactive Story Reel Walkthrough */}
      <ScreenStoryWalkthrough
        visible={storyVisible}
        userId={user?.userId}
        onClose={() => setStoryVisible(false)}
        onNavigateToTab={(tab) => {
          setStoryVisible(false);
          navigation.navigate('CustomerTabs', {
            screen: tab as keyof CustomerTabParamList,
          } as never);
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  heroCard: {
    backgroundColor: '#0F172A',
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
  },
  heroBadge: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.mintDark,
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  heroSub: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 6,
    lineHeight: 18,
  },
  tourBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
    marginTop: 12,
  },
  tourBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  filtersRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  filterTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  screenCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
    overflow: 'hidden',
  },
  screenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  screenIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  screenBadge: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  screenTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
    marginTop: 1,
  },
  screenSub: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  screenBody: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    backgroundColor: '#FFFFFF',
  },
  screenDesc: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.text,
    marginVertical: 8,
  },
  featuresBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    marginVertical: 6,
  },
  featuresHeading: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 5,
  },
  featureText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    color: colors.text,
  },
  tipBox: {
    backgroundColor: colors.mint,
    borderRadius: 10,
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
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1.5,
    marginTop: 8,
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  tipsSection: {
    marginTop: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  tipsSectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 12,
  },
  quickTipCard: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  tipNumber: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.mint,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.mintDark,
  },
  tipNumText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.primary,
  },
  quickTipHeading: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  quickTipBody: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 17,
    marginTop: 2,
  },
});
