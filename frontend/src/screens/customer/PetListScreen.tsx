import React, { useCallback, useState } from 'react';
import { View, FlatList, RefreshControl } from 'react-native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { CompositeScreenProps, useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { shared } from '../../theme/shared';
import { petApi, Pet } from '../../api/petApi';
import { AppHeader } from '../../components/common/AppHeader';
import { AppButton } from '../../components/common/AppButton';
import { EmptyState } from '../../components/common/EmptyState';
import { LoadingView } from '../../components/common/LoadingView';
import { PetCard } from '../../components/pet/PetCard';
import { CustomerStackParamList, CustomerTabParamList } from '../../navigation/types';
import { getErrorMessage, notify } from '../../utils/helpers';

type Props = CompositeScreenProps<
  BottomTabScreenProps<CustomerTabParamList, 'Pets'>,
  NativeStackScreenProps<CustomerStackParamList>
>;

export const PetListScreen: React.FC<Props> = ({ navigation }) => {
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

  if (loading) return <LoadingView />;

  return (
    <View style={shared.screen}>
      <AppHeader title="My Pets" rightAction={{ icon: 'add', onPress: () => navigation.navigate('AddEditPet', undefined) }} />
      <FlatList
        data={pets}
        keyExtractor={(p) => String(p.id)}
        contentContainerStyle={shared.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        ListEmptyComponent={
          <EmptyState
            title="No pets yet"
            message="Add your pet to book appointments and keep their medical history in one place."
            actionTitle="Add a Pet"
            onAction={() => navigation.navigate('AddEditPet', undefined)}
          />
        }
        renderItem={({ item }) => (
          <PetCard pet={item} onPress={() => navigation.navigate('PetDetails', { petId: item.id })} />
        )}
        ListFooterComponent={
          pets.length > 0 ? (
            <AppButton title="Add Another Pet" variant="mint" onPress={() => navigation.navigate('AddEditPet', undefined)} />
          ) : undefined
        }
      />
    </View>
  );
};
