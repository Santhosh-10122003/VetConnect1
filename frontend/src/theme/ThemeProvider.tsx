import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import { storage } from '../api/client';
import { applyScheme, Scheme } from './colors';

export type ThemeChoice = 'system' | 'light' | 'dark';
const KEY = 'jenni_theme_choice';

interface Ctx { choice: ThemeChoice; scheme: Scheme; setChoice: (c: ThemeChoice) => void }
const ThemeCtx = createContext<Ctx>({ choice: 'system', scheme: 'light', setChoice: () => {} });

export const useAppTheme = () => useContext(ThemeCtx);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const system = useColorScheme();
  const [choice, setChoiceState] = useState<ThemeChoice>('system');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    storage.getItem(KEY).then((v) => { if (v === 'light' || v === 'dark' || v === 'system') setChoiceState(v); }).finally(() => setLoaded(true));
  }, []);

  const scheme: Scheme = choice === 'system' ? (system === 'dark' ? 'dark' : 'light') : choice;
  // Set the colours before any child renders, so the very first frame already has them.
  applyScheme(scheme);

  const setChoice = useCallback((c: ThemeChoice) => { setChoiceState(c); storage.setItem(KEY, c); }, []);
  const value = useMemo(() => ({ choice, scheme, setChoice }), [choice, scheme, setChoice]);

  if (!loaded) return null;
  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
};
