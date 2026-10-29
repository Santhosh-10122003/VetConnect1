import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { walletApi } from '../../api/walletApi';
import { money } from '../../utils/helpers';

/** The balance at a glance: tap it to see where the money came from. */
export const WalletCard: React.FC<{ onPress: () => void }> = ({ onPress }) => {
  const [balance, setBalance] = useState<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      walletApi.mine(0, 1).then((w) => setBalance(w.balance)).catch(() => setBalance(null));
    }, [])
  );

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.9} testID="wallet-card">
      <View style={styles.icon}><Ionicons name="wallet" size={26} color={colors.primary} /></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.label}>Wallet</Text>
        <Text style={styles.balance} testID="wallet-balance">{balance == null ? '...' : money(balance)}</Text>
        <Text style={styles.sub}>Advances paid by pet owners</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.primary, borderRadius: 20, padding: 16, marginBottom: 16 },
  icon: { width: 50, height: 50, borderRadius: 16, backgroundColor: colors.mintDark, alignItems: 'center', justifyContent: 'center' },
  label: { color: colors.mintDark, fontSize: 12, fontWeight: '700' },
  balance: { color: '#FFFFFF', fontSize: 26, fontWeight: '800', marginTop: 1 },
  sub: { color: '#9CA3AF', fontSize: 11, marginTop: 2 },
});
