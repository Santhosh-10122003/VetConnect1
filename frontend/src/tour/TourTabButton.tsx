import React from 'react';
import { View } from 'react-native';
import { PlatformPressable } from '@react-navigation/elements';
import type { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { useTour } from './TourProvider';

/** A bottom-tab button the guided tour can point at. */
export const TourTabButton: React.FC<BottomTabBarButtonProps & { tourId: string }> = ({ tourId, ...props }) => {
  const tour = useTour();
  return (
    <View ref={tour.ref(tourId) as any} collapsable={false} style={{ flex: 1 }}>
      <PlatformPressable {...(props as any)} />
    </View>
  );
};
