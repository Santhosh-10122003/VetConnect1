import { StyleSheet, ViewStyle, TextStyle, ImageStyle } from 'react-native';
import { themeVersion } from './colors';

type Style = ViewStyle | TextStyle | ImageStyle;

/**
 * Like StyleSheet.create, but written as a function so the colours it reads are looked up again
 * whenever the theme changes. Used exactly like a normal `styles` object.
 */
export function themedStyles<T extends { [key: string]: Style }>(factory: () => T): T {
  let cache: T | null = null;
  let built = -1;
  const get = (): T => {
    const v = themeVersion();
    if (!cache || built !== v) { cache = StyleSheet.create(factory()) as T; built = v; }
    return cache;
  };
  return new Proxy({} as T, {
    get: (_t, key) => (get() as any)[key],
    has: (_t, key) => key in (get() as any),
    ownKeys: () => Reflect.ownKeys(get() as any),
    getOwnPropertyDescriptor: (_t, key) => ({ enumerable: true, configurable: true, value: (get() as any)[key] }),
  });
}

/** A lookup table (status labels, tints...) that reads theme colours, rebuilt when the theme changes. */
export function themedTable<T extends object>(factory: () => T): T {
  let cache: T | null = null;
  let built = -1;
  const get = (): T => {
    const v = themeVersion();
    if (!cache || built !== v) { cache = factory(); built = v; }
    return cache;
  };
  return new Proxy({} as T, {
    get: (_t, key) => (get() as any)[key],
    has: (_t, key) => key in (get() as any),
    ownKeys: () => Reflect.ownKeys(get() as any),
    getOwnPropertyDescriptor: (_t, key) => ({ enumerable: true, configurable: true, value: (get() as any)[key] }),
  });
}
