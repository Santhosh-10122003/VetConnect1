import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, FlatList, RefreshControl, TouchableOpacity } from 'react-native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { CompositeScreenProps, useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { petApi, Pet } from '../../api/petApi';
import { LoadingView } from '../../components/common/LoadingView';
import { ThemeToggle } from '../../components/common/ThemeToggle';
import { PetTile, AddPetTile, SPECIES_LABEL } from '../../components/pet/PetTile';
import { CustomerStackParamList, CustomerTabParamList } from '../../navigation/types';
import { getErrorMessage, notify } from '../../utils/helpers';
import { themedStyles } from '../../theme/themed';
import { useTopPad } from '../../utils/useTopPad';

type Props = CompositeScreenProps<
  BottomTabScreenProps<CustomerTabParamList, 'Pets'>,
  NativeStackScreenProps<CustomerStackParamList>
>;

type Item = { kind: 'pet'; pet: Pet } | { kind: 'add' } | { kind: 'spacer' };

const PLURAL: Record<string, string> = { DOG: 'Dogs', CAT: 'Cats', BIRD: 'Birds', RABBIT: 'Rabbits', OTHER: 'Other pets' };

export const PetListScreen: React.FC<Props> = ({ navigation }) => {
  const topPad = useTopPad(58);
  const [pets, setPets] = useState<Pet[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setPets((await petApi.getMyPets()).data);
    } catch (e) {
      notify('Error', getErrorMessage(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // "2 Dogs", "1 Cat": a quick summary under the title
  const summary = useMemo(() => {
    const counts: Record<string, number> = {};
    pets.forEach((p) => { counts[p.species] = (counts[p.species] ?? 0) + 1; });
    return Object.entries(counts).map(([k, n]) => ({ key: k, text: `${n} ${n === 1 ? SPECIES_LABEL[k] ?? 'Pet' : PLURAL[k] ?? 'Pets'}` }));
  }, [pets]);

  if (loading) return <LoadingView />;

  // two to a row: the pets, then the "add" tile, and a blank so the last tile keeps its size
  const items: Item[] = [...pets.map((pet) => ({ kind: 'pet', pet }) as Item), { kind: 'add' }];
  if (items.length % 2 === 1) items.push({ kind: 'spacer' });
  const add = () => navigation.navigate('AddEditPet', undefined);

  return (
    <View style={styles.page}>
      <View style={styles.blob} pointerEvents="none" />
      <FlatList
        data={items}
        numColumns={2}
        keyExtractor={(it, i) => (it.kind === 'pet' ? `p${it.pet.id}` : `${it.kind}${i}`)}
        columnWrapperStyle={{ gap: 14 }}
        contentContainerStyle={[styles.content, { paddingTop: topPad }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        ListHeaderComponent={
          <View>
            <View style={styles.topBar}>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>My pets</Text>
                <Text style={styles.subtitle}>
                  {pets.length === 0 ? 'Add your pet to get started' : `${pets.length} ${pets.length === 1 ? 'pet' : 'pets'} in your family`}
                </Text>
              </View>
              <ThemeToggle style={styles.round} />
              <TouchableOpacity style={[styles.round, styles.roundAdd]} onPress={add} activeOpacity={0.85} testID="pets-add" accessibilityLabel="Add a pet">
                <Ionicons name="add" size={26} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            {summary.length > 0 && (
              <View style={styles.chips}>
                {summary.map((s) => (
                  <View key={s.key} style={styles.chip}>
                    <Ionicons name="paw" size={12} color={colors.primary} />
                    <Text style={styles.chipText}>{s.text}</Text>
                  </View>
                ))}
              </View>
            )}

            {pets.length === 0 && (
              <View style={styles.hello} testID="pets-empty">
                <View style={styles.helloIcon}><Ionicons name="paw" size={26} color={colors.primary} /></View>
                <Text style={styles.helloTitle}>No pets yet</Text>
                <Text style={styles.helloText}>Add your pet once. Their details, photo and QR code are ready every time you book a visit.</Text>
              </View>
            )}
          </View>
        }
        renderItem={({ item }) =>
          item.kind === 'pet' ? (
            <PetTile pet={item.pet} onPress={() => navigation.navigate('PetDetails', { petId: item.pet.id })} />
          ) : item.kind === 'add' ? (
            <AddPetTile onPress={add} first={pets.length === 0} />
          ) : (
            <View style={{ flex: 1 }} />
          )
        }
      />
    </View>
  );
};

const styles = themedStyles(() => ({
  page: { flex: 1, backgroundColor: colors.canvas },
  blob: { position: 'absolute', top: -140, left: -100, width: 380, height: 340, borderRadius: 190, backgroundColor: colors.mintDark, opacity: 0.55 },
  content: { padding: 22, paddingTop: 58, paddingBottom: 110 },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  title: { fontSize: 30, fontWeight: '800', color: colors.ink },
  subtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  round: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.iconBorder },
  roundAdd: { backgroundColor: colors.primary, borderColor: colors.primary },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.iconBorder },
  chipText: { fontSize: 12, fontWeight: '700', color: colors.text },
  hello: { backgroundColor: colors.card, borderRadius: 24, padding: 20, marginBottom: 18, borderWidth: 1, borderColor: colors.border },
  helloIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
  helloTitle: { fontSize: 20, fontWeight: '800', color: colors.text, marginTop: 12 },
  helloText: { fontSize: 14, color: colors.textSecondary, marginTop: 6, lineHeight: 20 },
}));
