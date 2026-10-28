import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { colors } from '../../theme/colors';
import { shared } from '../../theme/shared';
import { careApi, CareBooking } from '../../api/careApi';
import { AppHeader } from '../../components/common/AppHeader';
import { KeyboardAvoid } from '../../components/common/KeyboardScroll';
import { AppButton } from '../../components/common/AppButton';
import { AppInput } from '../../components/common/AppInput';
import { EmptyState } from '../../components/common/EmptyState';
import { LoadingView } from '../../components/common/LoadingView';
import { BookingCard } from '../../components/care/BookingCard';
import { ProviderStackParamList } from '../../navigation/types';
import { getErrorMessage, money, notify, todayIso } from '../../utils/helpers';

type Props = NativeStackScreenProps<ProviderStackParamList, 'ProviderBookings'>;
type Group = 'REQUESTED' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';

const TABS: { key: Group; label: string }[] = [
  { key: 'REQUESTED', label: 'Requests' },
  { key: 'CONFIRMED', label: 'Confirmed' },
  { key: 'COMPLETED', label: 'Done' },
  { key: 'CANCELLED', label: 'Cancelled' },
];

export const ProviderBookingsScreen: React.FC<Props> = ({ navigation, route }) => {
  const [group, setGroup] = useState<Group>(route.params?.group ?? 'REQUESTED');
  const [items, setItems] = useState<CareBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  // the card asking for a reason before rejecting / cancelling
  const [asking, setAsking] = useState<{ id: number; kind: 'reject' | 'cancel' } | null>(null);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState('');

  const load = useCallback(async (g: Group) => {
    try {
      setItems((await careApi.providerBookings(g)).content);
    } catch (e) {
      notify('Error', getErrorMessage(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { setLoading(true); load(group); }, [load, group]));

  const act = async (b: CareBooking, fn: () => Promise<unknown>) => {
    setBusyId(b.id);
    try {
      await fn();
      setAsking(null);
      setReason('');
      await load(group);
    } catch (e) {
      notify('Action failed', getErrorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  const submitReason = (b: CareBooking) => {
    if (reason.trim().length < 3) {
      setReasonError('Give the customer a short reason.');
      return;
    }
    setReasonError('');
    if (asking?.kind === 'reject') act(b, () => careApi.reject(b.id, reason.trim()));
    else act(b, () => careApi.providerCancel(b.id, reason.trim()));
  };

  return (
    <KeyboardAvoid style={shared.screen}>
      <AppHeader title="Bookings" showBack onBack={() => navigation.goBack()} />
      <View style={shared.segment}>
        {TABS.map((t) => (
          <TouchableOpacity key={t.key} style={[shared.segmentItem, group === t.key && shared.segmentItemActive]} onPress={() => { setGroup(t.key); setAsking(null); }} testID={`tab-${t.key}`}>
            <Text style={[shared.segmentText, group === t.key && shared.segmentTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <LoadingView />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(b) => String(b.id)}
          contentContainerStyle={shared.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(group); }} />}
          ListEmptyComponent={<EmptyState icon="calendar-outline" title="Nothing here" message={group === 'REQUESTED' ? 'New requests from pet owners will show up here.' : 'No bookings in this list yet.'} />}
          renderItem={({ item: b }) => {
            const open = asking?.id === b.id;
            const canComplete = b.date <= todayIso();
            return (
              <BookingCard booking={b} viewer="provider">
                <View style={styles.money}>
                  <Text style={styles.moneyText}>Advance paid <Text style={styles.bold}>{money(b.advanceAmount)}</Text></Text>
                  <Text style={styles.moneyText}>Collect at the visit <Text style={styles.bold}>{money(b.balanceAmount)}</Text></Text>
                </View>
                {!!b.notes && <Text style={styles.notes}>Note: {b.notes}</Text>}
                {!!b.cancellationReason && <Text style={styles.cancel}>Reason: {b.cancellationReason}</Text>}

                {open ? (
                  <View style={{ marginTop: 12 }}>
                    <AppInput
                      label={asking!.kind === 'reject' ? 'Why are you declining? (the customer sees this)' : 'Why are you cancelling? (the customer sees this)'}
                      placeholder="e.g. We are fully booked that day"
                      value={reason}
                      onChangeText={(v) => { setReason(v); if (reasonError) setReasonError(''); }}
                      error={reasonError || undefined}
                      multiline
                      style={{ height: 70, textAlignVertical: 'top', paddingTop: 10 }}
                    />
                    <Text style={styles.refundNote}>The customer's advance is refunded in full.</Text>
                    <View style={styles.actions}>
                      <AppButton title="Back" variant="outline" style={styles.btn} onPress={() => setAsking(null)} />
                      <AppButton title={asking!.kind === 'reject' ? 'Decline' : 'Cancel booking'} variant="danger" style={styles.btn} loading={busyId === b.id} onPress={() => submitReason(b)} />
                    </View>
                  </View>
                ) : b.status === 'REQUESTED' ? (
                  <View style={styles.actions}>
                    <AppButton title="Decline" variant="outline" style={styles.btn} onPress={() => { setAsking({ id: b.id, kind: 'reject' }); setReason(''); }} />
                    <AppButton title="Accept" style={styles.btn} loading={busyId === b.id} onPress={() => act(b, () => careApi.accept(b.id))} />
                  </View>
                ) : b.status === 'CONFIRMED' ? (
                  <View>
                    <View style={styles.actions}>
                      <AppButton title="Cancel" variant="outline" style={styles.btn} onPress={() => { setAsking({ id: b.id, kind: 'cancel' }); setReason(''); }} />
                      <AppButton title="Mark done" style={styles.btn} disabled={!canComplete} loading={busyId === b.id} onPress={() => act(b, () => careApi.complete(b.id))} />
                    </View>
                    {!canComplete && <Text style={styles.hint}>You can mark it done on {b.date}.</Text>}
                  </View>
                ) : null}
              </BookingCard>
            );
          }}
        />
      )}
    </KeyboardAvoid>
  );
};

const styles = StyleSheet.create({
  money: { marginTop: 10, padding: 10, borderRadius: 10, backgroundColor: colors.mint, gap: 2 },
  moneyText: { fontSize: 12, color: colors.textSecondary },
  bold: { fontWeight: '800', color: colors.text },
  notes: { fontSize: 12, color: colors.textSecondary, marginTop: 8 },
  cancel: { fontSize: 12, color: colors.danger, marginTop: 8 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  btn: { flex: 1, height: 44 },
  hint: { fontSize: 11, color: colors.textSecondary, marginTop: 6 },
  refundNote: { fontSize: 11, color: colors.textSecondary, marginTop: -8, marginBottom: 4 },
});
