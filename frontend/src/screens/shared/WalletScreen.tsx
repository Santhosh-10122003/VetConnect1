import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { shared } from '../../theme/shared';
import { walletApi, Wallet, WalletTransaction } from '../../api/walletApi';
import { AppHeader } from '../../components/common/AppHeader';
import { EmptyState } from '../../components/common/EmptyState';
import { LoadingView } from '../../components/common/LoadingView';
import { getErrorMessage, money, notify } from '../../utils/helpers';

/** A doctor's (or pet-care business's) wallet: what the advances have earned, and the credits and refunds behind it. */
export const WalletScreen: React.FC<{ navigation: { goBack: () => void } }> = ({ navigation }) => {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setWallet(await walletApi.mine());
    } catch (e) {
      notify('Error', getErrorMessage(e));
    } finally {
      setRefreshing(false);
    }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!wallet) return <LoadingView />;

  const header = (
    <View>
      <View style={styles.hero}>
        <Text style={styles.heroLabel}>Wallet balance</Text>
        <Text style={styles.heroValue} testID="wallet-total">{money(wallet.balance)}</Text>
        <View style={styles.split}>
          <View style={{ flex: 1 }}>
            <Text style={styles.splitLabel}>Earned</Text>
            <Text style={styles.splitValue}>{money(wallet.totalEarned)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.splitLabel}>Refunded</Text>
            <Text style={styles.splitValue}>{money(wallet.totalRefunded)}</Text>
          </View>
        </View>
      </View>
      <Text style={styles.note}>
        Each advance a pet owner pays is added here. If a booking is cancelled and refunded, that amount is taken back out. Payouts go to the payment details on your profile.
      </Text>
      <Text style={shared.sectionTitle}>Activity</Text>
    </View>
  );

  const row = ({ item }: { item: WalletTransaction }) => {
    const credit = item.type === 'CREDIT';
    return (
      <View style={styles.row} testID={`wallet-row-${item.reference ?? item.id}`}>
        <View style={[styles.rowIcon, { backgroundColor: credit ? '#ECFDF5' : '#FEF2F2' }]}>
          <Ionicons name={credit ? 'arrow-down' : 'arrow-up'} size={18} color={credit ? colors.success : colors.danger} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.rowTitle} numberOfLines={2}>{item.description}</Text>
          <Text style={styles.rowSub}>{new Date(item.createdAt).toLocaleString()}</Text>
        </View>
        <Text style={[styles.rowAmount, { color: credit ? colors.success : colors.danger }]}>{credit ? '+' : '-'}{money(item.amount)}</Text>
      </View>
    );
  };

  return (
    <View style={shared.screen}>
      <AppHeader title="Wallet" showBack onBack={() => navigation.goBack()} />
      <FlatList
        data={wallet.transactions.content}
        keyExtractor={(t) => String(t.id)}
        renderItem={row}
        contentContainerStyle={shared.content}
        ListHeaderComponent={header}
        ListEmptyComponent={<EmptyState icon="wallet-outline" title="No payments yet" message="When a pet owner pays an advance for you, it shows up here." />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} colors={[colors.primary]} />}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  hero: { backgroundColor: colors.primary, borderRadius: 22, padding: 20, marginBottom: 14 },
  heroLabel: { color: colors.mintDark, fontSize: 13, fontWeight: '700' },
  heroValue: { color: '#FFFFFF', fontSize: 36, fontWeight: '800', marginTop: 4 },
  split: { flexDirection: 'row', marginTop: 16, gap: 12 },
  splitLabel: { color: '#9CA3AF', fontSize: 12 },
  splitValue: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', marginTop: 2 },
  note: { fontSize: 12, color: colors.textSecondary, lineHeight: 17, marginBottom: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: colors.border },
  rowIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 13, fontWeight: '700', color: colors.text },
  rowSub: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  rowAmount: { fontSize: 15, fontWeight: '800' },
});
