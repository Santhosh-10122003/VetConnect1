import React, { useRef, useState } from 'react';
import { Animated, Easing, LayoutChangeEvent, PanResponder, Platform, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

interface Props {
  label: string;
  onComplete: () => void;
  testID?: string;
}

const THUMB = 48;
const PAD = 5;
/** How far the handle has to travel (share of the bar) before letting go counts as "go". */
const THRESHOLD = 0.75;
/** A quick flick to the right also counts, even if it has not gone that far. */
const FLICK_SPEED = 0.7;
const FLICK_MIN_SHARE = 0.3;

/**
 * A "slide to continue" control: drag the round handle across the bar. The handle follows the finger (or the mouse)
 * exactly, the bar fills behind it, the words fade, and letting go either glides to the end or eases back.
 */
export const SlideToStart: React.FC<Props> = ({ label, onComplete, testID }) => {
  const [track, setTrack] = useState(0);
  const x = useRef(new Animated.Value(0)).current; // handle position, in pixels
  const lift = useRef(new Animated.Value(0)).current; // 0 resting, 1 held (a slight grow)
  const trackRef = useRef(0);
  const busy = useRef(false);

  const range = () => Math.max(1, trackRef.current - THUMB - PAD * 2);

  const setHeld = (held: boolean) =>
    Animated.timing(lift, { toValue: held ? 1 : 0, duration: 120, easing: Easing.out(Easing.quad), useNativeDriver: false }).start();

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !busy.current,
      onMoveShouldSetPanResponder: () => !busy.current,
      // nothing else on this page should take the gesture away mid-slide
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        x.stopAnimation();
        setHeld(true);
      },
      onPanResponderMove: (_e, g) => {
        x.setValue(Math.min(Math.max(0, g.dx), range()));
      },
      onPanResponderRelease: (_e, g) => {
        setHeld(false);
        const r = range();
        const share = g.dx / r;
        if (share >= THRESHOLD || (g.vx >= FLICK_SPEED && share >= FLICK_MIN_SHARE)) {
          busy.current = true;
          Animated.timing(x, { toValue: r, duration: 160, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start(() => {
            onComplete();
            // ready again if the person comes back to this page
            setTimeout(() => {
              x.setValue(0);
              busy.current = false;
            }, 400);
          });
        } else {
          Animated.timing(x, { toValue: 0, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
        }
      },
      onPanResponderTerminate: () => {
        setHeld(false);
        Animated.timing(x, { toValue: 0, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
      },
    })
  ).current;

  const onLayout = (e: LayoutChangeEvent) => {
    trackRef.current = e.nativeEvent.layout.width;
    setTrack(e.nativeEvent.layout.width);
  };

  const r = Math.max(1, track - THUMB - PAD * 2);
  const textOpacity = x.interpolate({ inputRange: [0, r * 0.6], outputRange: [1, 0], extrapolate: 'clamp' });
  // the sky-coloured fill grows with the handle and ends at its right edge
  const fillWidth = x.interpolate({ inputRange: [0, r], outputRange: [THUMB + PAD * 2, track || THUMB + PAD * 2], extrapolate: 'clamp' });
  const scale = lift.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });

  return (
    <View style={styles.track} onLayout={onLayout} testID={testID} accessibilityRole="adjustable" accessibilityLabel={`Slide to ${label}`}>
      <Animated.View style={[styles.fill, { width: fillWidth }]} pointerEvents="none" />
      <Animated.View style={[styles.labelWrap, { opacity: textOpacity }]} pointerEvents="none">
        <Text style={styles.label}>{label}</Text>
        <Ionicons name="chevron-forward" size={18} color="#6B7280" />
        <Ionicons name="chevron-forward" size={18} color="#9CA3AF" style={{ marginLeft: -10 }} />
        <Ionicons name="chevron-forward" size={18} color="#FFFFFF" style={{ marginLeft: -10 }} />
      </Animated.View>
      <Animated.View
        style={[styles.thumb, { transform: [{ translateX: x }, { scale }] }]}
        {...responder.panHandlers}
        testID={testID ? `${testID}-handle` : undefined}
      >
        <Ionicons name="paw" size={22} color={colors.primary} />
      </Animated.View>
    </View>
  );
};

// on the web, stop the browser from selecting text or scrolling instead of sliding
const webOnly = Platform.OS === 'web' ? ({ touchAction: 'none', userSelect: 'none', cursor: 'grab' } as object) : {};

const styles = StyleSheet.create({
  track: { flex: 1, height: 58, borderRadius: 29, backgroundColor: '#14171C', justifyContent: 'center', padding: PAD, overflow: 'hidden', ...webOnly },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 29, backgroundColor: 'rgba(143, 208, 244, 0.35)' },
  labelWrap: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingLeft: THUMB },
  label: { color: '#FFFFFF', fontSize: 15, fontWeight: '700', marginRight: 8 },
  thumb: { width: THUMB, height: THUMB, borderRadius: THUMB / 2, backgroundColor: colors.mintDark, alignItems: 'center', justifyContent: 'center', ...webOnly },
});
