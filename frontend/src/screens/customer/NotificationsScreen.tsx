import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { shared } from '../../theme/shared';
import { notificationApi, NotificationItem } from '../../api/notificationApi';
import { AppHeader } from '../../components/common/AppHeader';
import { EmptyState } from '../../components/common/EmptyState';
import { LoadingView } from '../../components/common/LoadingView';
import { getErrorMessage, notify } from '../../utils/helpers';

// Shared by the customer and doctor stacks, so it only needs goBack.
interface Props {
  navigation: { goBack: () => void };
}

const ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  BOOKING_CONFIRMED: 'checkmark-circle',
  APPOINTMENT_REMINDER: 'alarm',
  STATUS_CHANGE: 'swap-horizontal',
  DOCTOR_VERIFIED: 'shield-checkmark',
  DOCTOR_RESUBMITTED: 'refresh-circle',
  PROVIDER_VERIFIED: 'shield-checkmark',
  PROVIDER_RESUBMITTED: 'refresh-circle',
  CARE_BOOKING_REQUEST: 'cut-outline',
  CARE_BOOKING_UPDATE: 'cut-outline',
  CARE_PAYMENT: 'card-outline',
};

export const NotificationsScreen: React.FC<Props> = ({ navigation }) => {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setItems((await notificationApi.getMyNotifications(0, 50)).data.content);
    } catch (e) {
      notify('Error', getErrorMessage(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const markRead = async (n: NotificationItem) => {
    if (n.isRead) return;
    setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
    try {
      await notificationApi.markAsRead(n.id);
    } catch {
      load();
    }
  };

  const markAll = async () => {
    try {
      await notificationApi.markAllAsRead();
      setItems((prev) => prev.map((x) => ({ ...x, isRead: true })));
    } catch (e) {
      notify('Error', getErrorMessage(e));
    }
  };

  return (
    <View style={shared.screen}>
      <AppHeader
        title="Notifications"
        showBack
        onBack={() => navigation.goBack()}
        rightAction={{ icon: 'checkmark-done', onPress: markAll }}
      />
      {loading ? (
        <LoadingView />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(n) => String(n.id)}
          contentContainerStyle={shared.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          ListEmptyComponent={<EmptyState icon="notifications-outline" title="You're all caught up" message="Booking and appointment updates will show up here." />}
          renderItem={({ item }) => (
            <TouchableOpacity style={[styles.item, !item.isRead && styles.unread]} onPress={() => markRead(item)} activeOpacity={0.85}>
              <View style={styles.icon}>
                <Ionicons name={ICONS[item.notificationType] ?? 'notifications'} size={20} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.msg}>{item.message}</Text>
                <Text style={styles.time}>{new Date(item.createdAt).toLocaleString()}</Text>
              </View>
              {!item.isRead && <View style={styles.dot} />}
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  item: {
    flexDirection: 'row',
    gap: 12,
    padding: 14,
    marginBottom: 10,
    borderRadius: 14,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  unread: { backgroundColor: colors.mint, borderColor: colors.mintBorder },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 14, fontWeight: '700', color: colors.text },
  msg: { fontSize: 13, color: colors.textSecondary, marginTop: 2, lineHeight: 18 },
  time: { fontSize: 11, color: colors.textMuted, marginTop: 6 },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.primary, marginTop: 4 },
});
