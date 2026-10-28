import { colors } from './colors';

/** The dark bottom bar with a sky-blue active icon, shared by the customer and doctor tabs. */
export const tabBarOptions = (bottomInset: number) => ({
  headerShown: false,
  tabBarActiveTintColor: colors.secondary,
  tabBarInactiveTintColor: '#8A93A0',
  tabBarLabelStyle: { fontSize: 11, fontWeight: '700' as const },
  tabBarStyle: {
    backgroundColor: '#14171C',
    borderTopWidth: 0,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    height: 62 + bottomInset,
    paddingBottom: 8 + bottomInset,
    paddingTop: 8,
  },
});
