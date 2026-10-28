import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { colors } from '../../theme/colors';
import { shared } from '../../theme/shared';
import { careApi, CareService, CATEGORIES } from '../../api/careApi';
import { AppHeader } from '../../components/common/AppHeader';
import { AppButton } from '../../components/common/AppButton';
import { EmptyState } from '../../components/common/EmptyState';
import { LoadingView } from '../../components/common/LoadingView';
import { ProviderStackParamList } from '../../navigation/types';
import { getErrorMessage, money, notify } from '../../utils/helpers';

type Props = NativeStackScreenProps<ProviderStackParamList, 'ProviderServices'>;

export const priceLine = (s: CareService) =>
  `S ${money(s.priceSmall, 0)} · M ${money(s.priceMedium, 0)} · L ${money(s.priceLarge, 0)} · XL ${money(s.priceGiant, 0)}${s.pricingUnit === 'PER_NIGHT' ? ' / night' : ''}`;

export const ProviderServicesScreen: React.FC<Props> = ({ navigation }) => {
  const [services, setServices] = useState<CareService[] | null>(null);

  useFocusEffect(useCallback(() => {
    careApi.myServices().then(setServices).catch((e) => notify('Error', getErrorMessage(e)));
  }, []));

  if (!services) return <LoadingView />;

  return (
    <View style={shared.screen}>
      <AppHeader title="My services" showBack onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={shared.content}>
        <AppButton title="Add a service" onPress={() => navigation.navigate('ProviderServiceEdit')} style={{ marginBottom: 16 }} />

        {services.length === 0 && (
          <EmptyState icon="pricetags-outline" title="Your menu is empty" message="Add the services you offer and their prices. Customers book from this menu." />
        )}

        {CATEGORIES.map((cat) => {
          const list = services.filter((s) => s.category === cat.key);
          if (!list.length) return null;
          return (
            <View key={cat.key} style={{ marginBottom: 8 }}>
              <Text style={shared.sectionTitle}>{cat.label}</Text>
              {list.map((s) => (
                <TouchableOpacity
                  key={s.id}
                  style={[shared.card, !s.isActive && { opacity: 0.55 }]}
                  onPress={() => navigation.navigate('ProviderServiceEdit', { serviceId: s.id })}
                  activeOpacity={0.85}
                  testID={`service-${s.name}`}
                >
                  <View style={shared.rowBetween}>
                    <Text style={styles.name}>{s.name}</Text>
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      {s.isAddon && <Text style={styles.tag}>EXTRA</Text>}
                      {!s.isActive && <Text style={[styles.tag, styles.tagOff]}>OFF</Text>}
                    </View>
                  </View>
                  {!!s.description && <Text style={styles.desc}>{s.description}</Text>}
                  <Text style={styles.meta}>
                    {s.durationMinutes ? `${s.durationMinutes} min · ` : ''}{priceLine(s)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  name: { fontSize: 15, fontWeight: '700', color: colors.text, flex: 1 },
  desc: { fontSize: 12, color: colors.textSecondary, marginTop: 4 },
  meta: { fontSize: 12, color: colors.primary, fontWeight: '600', marginTop: 8 },
  tag: { fontSize: 10, fontWeight: '800', color: colors.primary, backgroundColor: colors.mint, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, overflow: 'hidden' },
  tagOff: { color: colors.danger, backgroundColor: '#FEF2F2' },
});
