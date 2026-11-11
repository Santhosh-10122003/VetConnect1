import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, Pressable, StyleProp, ViewStyle, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { themedStyles } from '../../theme/themed';
import { useAuth } from '../../context/AuthContext';
import { confirmAction } from '../../utils/helpers';
import { DeleteAccountCard } from './DeleteAccountCard';

/** A small three-line button. Tapping it opens a sheet with Edit profile (when there is something to edit), Sign out and Delete my account. */
export const AccountMenu: React.FC<{ style?: StyleProp<ViewStyle>; onEdit?: () => void; editing?: boolean }> = ({ style, onEdit, editing }) => {
  const { logout } = useAuth();
  const [open, setOpen] = useState(false);

  const signOut = async () => {
    if (await confirmAction('Sign out', 'You will need to sign in again.', 'Sign out', true)) {
      setOpen(false);
      await logout();
    }
  };

  return (
    <>
      <TouchableOpacity style={style} onPress={() => setOpen(true)} activeOpacity={0.85} testID="account-menu" accessibilityLabel="Account menu">
        <Ionicons name="menu" size={24} color={colors.text} />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
          <View style={styles.sheet} testID="account-sheet">
            <View style={styles.grab} />
            <View style={styles.head}>
              <Text style={styles.title}>Account</Text>
              <TouchableOpacity onPress={() => setOpen(false)} hitSlop={10} accessibilityLabel="Close menu">
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {!!onEdit && (
                <TouchableOpacity style={styles.row} onPress={() => { setOpen(false); onEdit(); }} activeOpacity={0.85} testID="menu-edit">
                  <View style={[styles.icon, { backgroundColor: colors.mint }]}><Ionicons name={editing ? 'close' : 'create-outline'} size={20} color={colors.primary} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.rowTitle, { color: colors.text }]}>{editing ? 'Stop editing' : 'Edit profile'}</Text>
                    <Text style={styles.rowSub}>{editing ? 'Go back to your details' : 'Change your details'}</Text>
                  </View>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.row} onPress={signOut} activeOpacity={0.85} testID="menu-signout">
                <View style={styles.icon}><Ionicons name="log-out-outline" size={20} color={colors.danger} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>Sign out</Text>
                  <Text style={styles.rowSub}>You will need to sign in again</Text>
                </View>
              </TouchableOpacity>
              <DeleteAccountCard />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
};

const styles = themedStyles(() => ({
  fill: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...({ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as const), backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { backgroundColor: colors.card, borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 18, paddingBottom: 18, maxHeight: '85%', borderWidth: 1, borderColor: colors.border },
  grab: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginTop: 10, marginBottom: 6 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 },
  title: { fontSize: 20, fontWeight: '800', color: colors.text },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  icon: { width: 42, height: 42, borderRadius: 14, backgroundColor: colors.dangerBg, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 15, fontWeight: '800', color: colors.danger },
  rowSub: { fontSize: 12, color: colors.textSecondary, marginTop: 1 },
}));
