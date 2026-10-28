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
const SUPPORT_EMAIL = 'support@vetconnect.example';
const SUPPORT_PHONE = '+910000000000';
const EMERGENCY_LINES = [
  { name: 'VetConnect 24x7 Emergency Line', number: '+910000000001' },
  { name: 'Poison & Toxicity Helpline', number: '+910000000002' },
];

const FAQS = [
  {
    q: 'How do I book an appointment?',
    a: 'Open Find Doctors, choose a veterinarian, pick a date and an available time slot, select your pet and confirm. The doctor then accepts or declines the request.',
  },
  {
    q: 'Can I reschedule or cancel?',
    a: 'Yes. Open the appointment from My Appointments and choose Reschedule or Cancel while it is Pending or Confirmed.',
  },
  {
    q: 'How do I pay?',
    a: 'Payment is made at the clinic after your consultation. Online payments are not enabled yet.',
  },
  {
    q: 'Where can I see my pet’s prescriptions?',
    a: 'Open the pet under Pets and check the Medical History tab. Prescriptions appear after your vet completes the visit.',
  },
  {
    q: 'What if my pet has an emergency?',
    a: 'Do not wait for a booking. Call an emergency line below or go to the nearest 24-hour veterinary hospital.',
  },
];

export const HelpSupportScreen: React.FC<Props> = ({ navigation }) => {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <View style={shared.screen}>
      <AppHeader title="Help & Support" showBack onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={shared.content}>
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
