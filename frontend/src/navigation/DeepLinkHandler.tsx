import { useEffect } from 'react';
import * as Linking from 'expo-linking';
import { petNumberFromUrl, showScannedPet } from '../utils/petLink';

/** Listens for links that open the app. A pet's QR code opens straight on its owner's details (see PetFoundScreen). */
export const DeepLinkHandler: React.FC = () => {
  useEffect(() => {
    const take = (url: string | null) => {
      const n = petNumberFromUrl(url);
      if (n) showScannedPet(n);
    };
    Linking.getInitialURL().then(take).catch(() => {});
    const sub = Linking.addEventListener('url', (e) => take(e.url));
    return () => sub.remove();
  }, []);
  return null;
};
