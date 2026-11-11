import { Alert, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import type { PickedFile } from '../api/documentApi';

const fromResult = (res: ImagePicker.ImagePickerResult): PickedFile | null => {
  if (res.canceled || !res.assets?.length) return null;
  const a = res.assets[0];
  return { uri: a.uri, name: a.fileName ?? 'pet.jpg', mimeType: a.mimeType ?? 'image/jpeg', file: (a as { file?: File }).file };
};

const options = { mediaTypes: ['images'] as ImagePicker.MediaType[], allowsEditing: true, aspect: [1, 1] as [number, number], quality: 0.7 };

const fromGallery = async () => {
  if (Platform.OS !== 'web') {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Allow photos', 'Allow Jenni to open your photos in Settings to add a picture of your pet.'); return null; }
  }
  return fromResult(await ImagePicker.launchImageLibraryAsync(options));
};

const fromCamera = async () => {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) { Alert.alert('Allow camera', 'Allow Jenni to use the camera in Settings to take a picture of your pet.'); return null; }
  return fromResult(await ImagePicker.launchCameraAsync(options));
};

/** Asks where the picture should come from (a phone can use its camera) and returns the chosen photo, or null. */
export const pickPetPhoto = (): Promise<PickedFile | null> => {
  if (Platform.OS === 'web') return fromGallery();
  return new Promise((resolve) => {
    Alert.alert('Pet photo', 'Where is the picture?', [
      { text: 'Take a photo', onPress: () => fromCamera().then(resolve, () => resolve(null)) },
      { text: 'Choose from photos', onPress: () => fromGallery().then(resolve, () => resolve(null)) },
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
    ], { cancelable: true, onDismiss: () => resolve(null) });
  });
};
