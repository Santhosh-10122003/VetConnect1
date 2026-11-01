import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { shared } from '../../theme/shared';
import { AppHeader } from '../../components/common/AppHeader';
import { CustomerStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<CustomerStackParamList, 'HelpSupport'>;

// Placeholder contact details: replace with your organisation's real numbers before release.
const SUPPORT_EMAIL = 'support@jenni.example';
const SUPPORT_PHONE = '+910000000000';
const EMERGENCY_LINES = [
  { name: 'Jenni 24x7 Emergency Line', number: '+910000000001' },
  { name: 'Poison & Toxicity Helpline', number: '+910000000002' },
];

const FAQS = [
  {
    q: 'How do I book an appointment?',
    a: 'Open Find Doctors, choose a veterinarian, pick a date and an available time slot, select your pet and confirm with a 50% advance. The doctor then accepts or declines the request.',
  },
  {
    q: 'How do the different screens work?',
    a: 'Tap the "Explore Screen Guide" banner at the top of this screen or from Profile to see a comprehensive walkthrough of each screen, with easy tips and live previews.',
  },
  {
    q: 'Can I reschedule or cancel?',
    a: 'Yes. Open the appointment from Visits (Appointments tab) and choose Reschedule or Cancel while it is Pending or Confirmed. Cancelling 24 hours prior gives you a 100% refund.',
  },
  {
    q: 'How do payments and advances work?',
    a: '50% of the consultation fee is paid online as an advance via Razorpay to hold your slot for 15 minutes. The remaining 50% is paid directly at the clinic.',
  },
  {
    q: 'Where can I see my pet’s prescriptions?',
    a: 'Open the pet under My Pets and check the Medical History tab. Prescriptions and doctor notes appear as soon as your vet completes the consultation.',
  },
  {
    q: 'What if my pet has an emergency?',
    a: 'Do not wait for a regular booking. Call the 24x7 emergency helpline above or navigate to the nearest 24-hour veterinary emergency hospital immediately.',
  },
];

export const HelpSupportScreen: React.FC<Props> = ({ navigation }) => {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <View style={shared.screen}>
      <AppHeader title="Help & Support" showBack onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={shared.content}>
        {/* Screen Guide Card */}
        <TouchableOpacity
          style={styles.guideCard}
          onPress={() => navigation.navigate('AppGuide')}
          activeOpacity={0.9}
        >
          <View style={styles.guideCardIcon}>
            <Ionicons name="compass" size={24} color="#FFFFFF" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.guideCardTitle}>Jenni Screen Guide & Tips</Text>
            <Text style={styles.guideCardSub}>
              New to the app? Learn what each screen does and how to book easily.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.primaryLight} />
        </TouchableOpacity>

        <Text style={shared.sectionTitle}>Emergency hotlines</Text>
        {EMERGENCY_LINES.map((l) => (
          <TouchableOpacity key={l.number} style={styles.emergency} onPress={() => Linking.openURL(`tel:${l.number}`)}>
            <Ionicons name="call" size={22} color="#FFFFFF" />
            <View style={{ flex: 1 }}>
              <Text style={styles.emName}>{l.name}</Text>
              <Text style={styles.emNum}>{l.number}</Text>
            </View>
          </TouchableOpacity>
        ))}

        <Text style={[shared.sectionTitle, { marginTop: 18 }]}>Frequently asked questions</Text>
        {FAQS.map((f, i) => (
          <TouchableOpacity key={f.q} style={shared.card} onPress={() => setOpen(open === i ? null : i)} activeOpacity={0.9}>
            <View style={shared.rowBetween}>
              <Text style={styles.q}>{f.q}</Text>
              <Ionicons name={open === i ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
            </View>
            {open === i && <Text style={styles.a}>{f.a}</Text>}
          </TouchableOpacity>
        ))}

        <Text style={[shared.sectionTitle, { marginTop: 8 }]}>Contact support</Text>
        <View style={shared.card}>
          <TouchableOpacity style={styles.contact} onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}>
            <Ionicons name="mail-outline" size={20} color={colors.primary} />
            <Text style={styles.contactText}>{SUPPORT_EMAIL}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.contact} onPress={() => Linking.openURL(`tel:${SUPPORT_PHONE}`)}>
            <Ionicons name="call-outline" size={20} color={colors.primary} />
            <Text style={styles.contactText}>{SUPPORT_PHONE}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  guideCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.mint,
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.mintBorder,
    gap: 12,
  },
  guideCardIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guideCardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.primary,
  },
  guideCardSub: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 16,
    marginTop: 2,
  },
  emergency: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.danger,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
  },
  emName: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  emNum: { color: '#FEE2E2', fontSize: 13, marginTop: 2 },
  q: { flex: 1, fontSize: 14, fontWeight: '700', color: colors.text, paddingRight: 8 },
  a: { marginTop: 10, fontSize: 13, color: colors.textSecondary, lineHeight: 19 },
  contact: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  contactText: { fontSize: 14, color: colors.text, fontWeight: '500' },
});
