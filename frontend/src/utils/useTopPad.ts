import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Space for a screen's top row: at least `min`, and always below the phone's clock and notch. */
export const useTopPad = (min = 12): number => {
  const { top } = useSafeAreaInsets();
  return Math.max(min, top + 12);
};
