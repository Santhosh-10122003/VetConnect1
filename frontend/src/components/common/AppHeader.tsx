import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { themedStyles } from '../../theme/themed';
import { AccountMenu } from './AccountMenu';
import { useTopPad } from '../../utils/useTopPad';

interface AppHeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  /** Show the light/dark switch at the left (home screens). */
  /** Show the three-line account menu (sign out, delete account) at the left. */
  accountMenu?: { onEdit?: () => void; editing?: boolean };
  rightAction?: {
    icon: keyof typeof Ionicons.glyphMap;
    onPress: () => void;
  };
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  title,
  subtitle,
  showBack,
  onBack,
  accountMenu,
  rightAction,
}) => {
  const topPad = useTopPad(12);
  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <StatusBar style="dark" />
      <View style={styles.content}>
        {showBack ? (
          <TouchableOpacity onPress={onBack} style={styles.iconButton} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
        ) : (
          <View style={styles.placeholder} />
        )}

        <View style={styles.titleContainer}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          {subtitle && <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>}
        </View>

        {accountMenu ? (
          <AccountMenu style={styles.iconButton} onEdit={accountMenu.onEdit} editing={accountMenu.editing} />
        ) : rightAction ? (
          <TouchableOpacity onPress={rightAction.onPress} style={styles.iconButton} activeOpacity={0.7}>
            <Ionicons name={rightAction.icon} size={22} color={colors.primary} />
          </TouchableOpacity>
        ) : (
          <View style={styles.placeholder} />
        )}
      </View>
    </View>
  );
};

const styles = themedStyles(() => ({
  container: {
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingTop: 12,
    paddingBottom: 12,
    paddingHorizontal: 16,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.mint,
    borderWidth: 1,
    borderColor: colors.iconBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholder: {
    width: 40,
  },
  titleContainer: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  subtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
}));
