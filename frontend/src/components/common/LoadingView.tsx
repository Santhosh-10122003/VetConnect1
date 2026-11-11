import React from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import { colors } from '../../theme/colors';
import { themedStyles } from '../../theme/themed';

interface LoadingViewProps {
  message?: string;
}

export const LoadingView: React.FC<LoadingViewProps> = ({ message = 'Loading...' }) => {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={colors.primary} />
      {message && <Text style={styles.message}>{message}</Text>}
    </View>
  );
};

const styles = themedStyles(() => ({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.page,
    padding: 20,
  },
  message: {
    marginTop: 14,
    fontSize: 15,
    color: colors.textSecondary,
    fontWeight: '500',
  },
}));
