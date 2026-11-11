import { createNavigationContainerRef } from '@react-navigation/native';

/** Lets code outside any screen (the guided tour) move around the app. */
export const navigationRef = createNavigationContainerRef<any>();
