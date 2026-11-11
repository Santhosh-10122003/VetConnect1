import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, useWindowDimensions, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { storage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { navigationRef } from '../navigation/navigationRef';
import { TOURS, TOUR_HOME } from './tours';
import { wasScanned } from '../utils/petLink';
import { themedStyles } from '../theme/themed';

interface TourContextValue {
  /** Marks a view as something the tour can point at: `<View ref={tour.ref('id')} collapsable={false}>`. */
  ref: (id: string) => (el: unknown) => void;
  /** Starts the tour for the signed-in person, from the beginning. */
  start: () => void;
  running: boolean;
}

const TourContext = createContext<TourContextValue>({ ref: () => () => {}, start: () => {}, running: false });
export const useTour = () => useContext(TourContext);

interface Rect { x: number; y: number; w: number; h: number }

const hiddenKey = (userId: number | string) => `jenni_tour_hidden_${userId}`;
const PAD = 6;
const DIM = 'rgba(15, 17, 21, 0.62)';


/**
 * A step-by-step walk through the app: the rest of the screen is dimmed, the thing being explained is lit up, and a
 * card says what it is. "Hide this on launch" stops it opening by itself next time; it can always be replayed.
 */
// kept outside the component so switching light/dark (which rebuilds the app) does not show the tour again
let autoShownFor: unknown = null;

export const TourProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { width, height } = useWindowDimensions();
  const targets = useRef(new Map<string, any>());
  const callbacks = useRef(new Map<string, (el: unknown) => void>());
  const [running, setRunning] = useState(false);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [hide, setHide] = useState(false);
  const [cardH, setCardH] = useState(0);
  const fade = useRef(new Animated.Value(0)).current;

  const steps = TOURS[user?.role ?? ''] ?? [];
  const step = steps[index];

  const ref = useCallback((id: string) => {
    let cb = callbacks.current.get(id);
    if (!cb) {
      cb = (el: unknown) => { if (el) targets.current.set(id, el); else targets.current.delete(id); };
      callbacks.current.set(id, cb);
    }
    return cb;
  }, []);

  const start = useCallback(() => {
    if (!user || (TOURS[user.role] ?? []).length === 0) return;
    const home = TOUR_HOME[user.role];
    if (home && navigationRef.isReady()) navigationRef.navigate(home.name, home.params);
    setIndex(0);
    setRect(null);
    setHide(false);
    // let the home screen settle so its pieces can be measured
    setTimeout(() => setRunning(true), 500);
  }, [user]);

  // shows itself once per sign-in until the person ticks "Hide this on launch" (or finishes it)
  useEffect(() => {
    if (!user?.userId || (TOURS[user.role] ?? []).length === 0) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    storage.getItem(hiddenKey(user.userId)).then((v) => {
      if (!cancelled && v !== 'true' && autoShownFor !== user.userId) timer = setTimeout(() => { if (!wasScanned()) { autoShownFor = user.userId; start(); } }, 1600);
    }).catch(() => {});
    return () => { cancelled = true; clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.userId, user?.role]);

  // find the thing this step points at
  useEffect(() => {
    if (!running || !step) return;
    let cancelled = false;
    const measure = (attempt: number) => {
      const el = step.target ? targets.current.get(step.target) : null;
      if (!el || typeof el.measureInWindow !== 'function') {
        if (step.target && attempt < 3) setTimeout(() => !cancelled && measure(attempt + 1), 250);
        else if (!cancelled) setRect(null);
        return;
      }
      el.measureInWindow((x: number, y: number, w: number, h: number) => {
        if (cancelled) return;
        const visible = w > 0 && h > 0 && x + w > 0 && y + h > 0 && x < width && y < height;
        if (visible) setRect({ x, y, w, h });
        else if (attempt < 3) setTimeout(() => !cancelled && measure(attempt + 1), 250);
        else setRect(null);
      });
    };
    setRect(null);
    fade.setValue(0);
    const t = setTimeout(() => measure(0), 120);
    Animated.timing(fade, { toValue: 1, duration: 260, delay: 150, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    return () => { cancelled = true; clearTimeout(t); };
  }, [running, index, step, width, height, fade]);

  const close = (finished: boolean) => {
    setRunning(false);
    if (user?.userId && (hide || finished)) storage.setItem(hiddenKey(user.userId), 'true').catch(() => {});
  };

  const next = () => (index >= steps.length - 1 ? close(true) : setIndex(index + 1));

  // ---- where the card goes
  const cardW = Math.min(width - 32, 340);
  const hole = rect ? { x: rect.x - PAD, y: rect.y - PAD, w: rect.w + PAD * 2, h: rect.h + PAD * 2 } : null;
  let cardLeft = (width - cardW) / 2;
  let cardTop = Math.max(60, (height - cardH) / 2);
  let arrow: { left: number; below: boolean } | null = null;
  if (hole) {
    const cx = hole.x + hole.w / 2;
    cardLeft = Math.min(Math.max(cx - cardW / 2, 16), width - cardW - 16);
    const below = hole.y + hole.h + 16 + cardH <= height - 12;
    cardTop = below ? hole.y + hole.h + 14 : Math.max(12, hole.y - 14 - cardH);
    arrow = { left: Math.min(Math.max(cx - cardLeft - 8, 18), cardW - 34), below };
  }

  return (
    <TourContext.Provider value={{ ref, start, running }}>
      <View style={{ flex: 1 }}>
        {children}
        {running && step && (
          <View style={styles.overlay} testID="tour-overlay">
            {hole ? (
              <>
                <View style={[styles.dim, { left: 0, top: 0, right: 0, height: Math.max(0, hole.y) }]} />
                <View style={[styles.dim, { left: 0, top: hole.y + hole.h, right: 0, bottom: 0 }]} />
                <View style={[styles.dim, { left: 0, top: hole.y, width: Math.max(0, hole.x), height: hole.h }]} />
                <View style={[styles.dim, { left: hole.x + hole.w, top: hole.y, right: 0, height: hole.h }]} />
                {/* the lit-up thing is not tappable while the tour is on */}
                <View style={{ position: 'absolute', left: hole.x, top: hole.y, width: hole.w, height: hole.h, borderRadius: 16, borderWidth: 2, borderColor: '#FFFFFF' }} />
              </>
            ) : (
              <View style={[styles.dim, { left: 0, top: 0, right: 0, bottom: 0 }]} />
            )}

            <Animated.View
              onLayout={(e) => setCardH(e.nativeEvent.layout.height)}
              style={[styles.card, { width: cardW, left: cardLeft, top: cardTop, opacity: cardH === 0 ? 0 : fade }]}
              testID="tour-card"
            >
              {arrow && <View style={[styles.arrow, arrow.below ? { top: -7 } : { bottom: -7 }, { left: arrow.left }]} />}
              <Text style={styles.title} testID="tour-title">{step.title}</Text>
              <Text style={styles.text}>{step.text}</Text>
              <View style={styles.divider} />
              <View style={styles.footer}>
                <Text style={styles.count} testID="tour-count">{index + 1}/{steps.length}</Text>
                <TouchableOpacity style={styles.checkRow} onPress={() => setHide((h) => !h)} activeOpacity={0.8} testID="tour-hide">
                  <View style={[styles.box, hide && styles.boxOn]}>{hide && <Ionicons name="checkmark" size={13} color="#FFFFFF" />}</View>
                  <Text style={styles.checkText}>Hide this on launch</Text>
                </TouchableOpacity>
                <View style={{ flex: 1 }} />
                {index < steps.length - 1 && (
                  <TouchableOpacity onPress={() => close(false)} style={styles.skip} testID="tour-skip">
                    <Text style={styles.skipText}>Skip</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={next} style={styles.next} activeOpacity={0.85} testID="tour-next">
                  <Text style={styles.nextText}>{index >= steps.length - 1 ? 'Done' : 'Next'}</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </View>
        )}
      </View>
    </TourContext.Provider>
  );
};

const styles = themedStyles(() => ({
  overlay: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, zIndex: 9999, elevation: 9999 },
  dim: { position: 'absolute', backgroundColor: DIM },
  card: {
    position: 'absolute', backgroundColor: colors.card, borderRadius: 14, paddingHorizontal: 18, paddingTop: 18, paddingBottom: 14,
    shadowColor: '#000000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.25, shadowRadius: 16, elevation: 12,
  },
  arrow: { position: 'absolute', width: 14, height: 14, backgroundColor: colors.card, transform: [{ rotate: '45deg' }] },
  title: { fontSize: 22, fontWeight: '500', color: colors.text },
  text: { fontSize: 14, color: '#6B7280', lineHeight: 21, marginTop: 8 },
  divider: { height: 1, backgroundColor: colors.border, marginTop: 14, marginBottom: 12 },
  footer: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', rowGap: 8 },
  count: { fontSize: 13, color: '#6B7280', marginRight: 14 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  box: { width: 18, height: 18, borderRadius: 3, borderWidth: 1.5, borderColor: '#6B7280', alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: colors.primaryLight, borderColor: colors.primaryLight },
  checkText: { fontSize: 13, color: colors.text },
  skip: { paddingHorizontal: 12, paddingVertical: 8 },
  skipText: { fontSize: 14, fontWeight: '600', color: colors.primaryLight },
  next: { backgroundColor: colors.primaryLight, borderRadius: 4, paddingHorizontal: 18, paddingVertical: 9 },
  nextText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
}));
