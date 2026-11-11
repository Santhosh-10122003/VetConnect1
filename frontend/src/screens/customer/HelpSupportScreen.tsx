import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { shared } from '../../theme/shared';
import { AppHeader } from '../../components/common/AppHeader';
import { CustomerStackParamList } from '../../navigation/types';
import { themedStyles } from '../../theme/themed';

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
    q: 'How do I book a visit?',
    a: 'Open Doctors, choose a vet, pick a day and a free time, choose your pet and pay the advance (half of the vet fee) to keep your time. The vet then accepts or declines.',
  },
  {
    q: 'How do the different screens work?',
    a: 'Tap Take the app tour on your Profile screen for a step-by-step walk through the app, as many times as you like.',
  },
  {
    q: 'Can I change the time or cancel?',
    a: 'Yes. Open the visit from the Visits tab and choose Change time or Cancel visit. If you cancel at least 24 hours before, you get all of your advance back.',
  },
  {
    q: 'How do I pay?',
    a: 'You pay half of the vet fee online now (the advance). We keep your time for 15 minutes while you pay. You pay the other half at the clinic.',
  },
  {
    q: 'Where can I see my pet’s prescriptions?',
    a: 'Open your pet under Pets and look at the Medical History tab. Medicines and the vet\u2019s notes appear there after the visit.',
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

const styles = themedStyles(() => ({
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
  emNum: { color: colors.dangerBg, fontSize: 13, marginTop: 2 },
  q: { flex: 1, fontSize: 14, fontWeight: '700', color: colors.text, paddingRight: 8 },
  a: { marginTop: 10, fontSize: 13, color: colors.textSecondary, lineHeight: 19 },
  contact: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  contactText: { fontSize: 14, color: colors.text, fontWeight: '500' },
}));
