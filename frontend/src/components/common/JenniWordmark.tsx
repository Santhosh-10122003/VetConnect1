import React, { useEffect, useRef } from 'react';
import { View, Animated, Easing } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { colors } from '../../theme/colors';

// the app's own colours: ink, sky blue and soft sky
const RED = colors.primary;
const YEL = colors.secondary;
const BLU = colors.primaryLight;

interface Piece {
  key: string;
  /** Where the piece sits in the finished word (top-left of its box). */
  x: number;
  y: number;
  w: number;
  h: number;
  draw: () => React.ReactNode;
}

// "jenni" built from circles, bars and arches, all the same stroke weight (12)
const PIECES: Piece[] = [
  // j
  { key: 'j-dot', x: 14, y: 14, w: 16, h: 16, draw: () => <Circle cx={8} cy={8} r={8} fill={YEL} /> },
  { key: 'j-bar', x: 16, y: 44, w: 12, h: 56, draw: () => <Rect x={0} y={0} width={12} height={56} fill={BLU} /> },
  { key: 'j-hook', x: 0, y: 100, w: 28, h: 26, draw: () => <Path d="M22 0 V6 A14 14 0 0 1 8 20 H0" stroke={RED} strokeWidth={12} fill="none" /> },
  // e
  { key: 'e-ring', x: 52, y: 44, w: 52, h: 52, draw: () => <Path d="M46 26 A20 20 0 1 0 37.5 42.4" stroke={RED} strokeWidth={12} fill="none" /> },
  { key: 'e-bar', x: 64, y: 66, w: 28, h: 8, draw: () => <Rect x={0} y={0} width={28} height={8} fill={YEL} /> },
  // n
  { key: 'n1-arch', x: 120, y: 44, w: 44, h: 22, draw: () => (<><Path d="M6 22 A16 16 0 0 1 38 22" stroke={BLU} strokeWidth={12} fill="none" /><Path d="M13 22 A9 9 0 0 1 31 22 Z" fill={YEL} /></>) },
  { key: 'n1-l', x: 120, y: 66, w: 12, h: 30, draw: () => <Rect x={0} y={0} width={12} height={30} fill={RED} /> },
  { key: 'n1-r', x: 152, y: 66, w: 12, h: 30, draw: () => <Rect x={0} y={0} width={12} height={30} fill={RED} /> },
  // n
  { key: 'n2-arch', x: 180, y: 44, w: 44, h: 22, draw: () => (<><Path d="M6 22 A16 16 0 0 1 38 22" stroke={RED} strokeWidth={12} fill="none" /><Path d="M13 22 A9 9 0 0 1 31 22 Z" fill={YEL} /></>) },
  { key: 'n2-l', x: 180, y: 66, w: 12, h: 30, draw: () => <Rect x={0} y={0} width={12} height={30} fill={BLU} /> },
  { key: 'n2-r', x: 212, y: 66, w: 12, h: 30, draw: () => <Rect x={0} y={0} width={12} height={30} fill={BLU} /> },
  // i
  { key: 'i-dot', x: 238, y: 14, w: 16, h: 16, draw: () => <Circle cx={8} cy={8} r={8} fill={YEL} /> },
  { key: 'i-bar', x: 240, y: 44, w: 12, h: 52, draw: () => <Rect x={0} y={0} width={12} height={52} fill={RED} /> },
];

const W = 262;
const H = 130;

/** Where each piece starts (falling in from above, spinning) and where it goes during the shuffle, from its position in the list. */
const pose = (i: number) => ({
  from: { dx: ((i * 37) % 200) - 100, dy: -(120 + ((i * 23) % 80)), rot: ((i * 53) % 360) - 180, s: 0.4 },
  alt: { dx: ((i * 61) % 90) - 45, dy: ((i * 29) % 70) - 35, rot: ((i * 97) % 270) - 135, s: 0.85 + ((i * 7) % 5) / 20 },
});

/**
 * The word "jenni" made of colourful shapes. The pieces drop in and spin into place, break apart and shuffle,
 * then snap together again for the finished word.
 */
export const JenniWordmark: React.FC<{ scale?: number }> = ({ scale = 1 }) => {
  const progress = useRef(PIECES.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    const run = Animated.parallel(
      progress.map((p, i) =>
        Animated.sequence([
          Animated.delay(i * 55),
          Animated.timing(p, { toValue: 1, duration: 800, easing: Easing.out(Easing.back(1.3)), useNativeDriver: false }),
          Animated.delay(450),
          Animated.timing(p, { toValue: 2, duration: 700, easing: Easing.inOut(Easing.cubic), useNativeDriver: false }),
          Animated.delay(150),
          Animated.timing(p, { toValue: 3, duration: 800, easing: Easing.out(Easing.back(1.1)), useNativeDriver: false }),
        ])
      )
    );
    run.start();
    return () => run.stop();
  }, [progress]);

  return (
    <View style={{ width: W * scale, height: H * scale, alignItems: 'center', justifyContent: 'center' }} testID="jenni-wordmark">
      <View style={{ width: W, height: H, transform: [{ scale }] }}>
        {PIECES.map((piece, i) => {
          const { from, alt } = pose(i);
          const p = progress[i];
          const map = (a: number, b: number, c: number) => p.interpolate({ inputRange: [0, 1, 2, 3], outputRange: [a, b, c, b] });
          return (
            <Animated.View
              key={piece.key}
              style={{
                position: 'absolute', left: piece.x, top: piece.y, width: piece.w, height: piece.h,
                opacity: p.interpolate({ inputRange: [0, 0.35, 3], outputRange: [0, 1, 1] }),
                transform: [
                  { translateX: map(from.dx, 0, alt.dx) },
                  { translateY: map(from.dy, 0, alt.dy) },
                  { rotate: p.interpolate({ inputRange: [0, 1, 2, 3], outputRange: [`${from.rot}deg`, '0deg', `${alt.rot}deg`, '0deg'] }) },
                  { scale: map(from.s, 1, alt.s) },
                ],
              }}
            >
              <Svg width={piece.w} height={piece.h}>{piece.draw()}</Svg>
            </Animated.View>
          );
        })}
      </View>
    </View>
  );
};

