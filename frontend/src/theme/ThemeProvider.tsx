import React, { createContext, useContext } from 'react';
import { Appearance } from 'react-native';
import type { Scheme } from './colors';

// Jenni has one look: light. Tell the system too, so native pieces (keyboard, date pickers, alerts)
// stay light even when the phone itself is in dark mode.
try { Appearance.setColorScheme('light'); } catch { /* older runtimes: the JS theme is light anyway */ }

interface Ctx { scheme: Scheme }
const ThemeCtx = createContext<Ctx>({ scheme: 'light' });

export const useAppTheme = () => useContext(ThemeCtx);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ThemeCtx.Provider value={{ scheme: 'light' }}>{children}</ThemeCtx.Provider>
);
