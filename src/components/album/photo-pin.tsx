import { Image, type ImageSource } from 'expo-image';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Palette } from '@/constants/theme';

type PhotoPinProps = {
  source?: ImageSource;
  selected: boolean;
  /** Reprises supplémentaires au même endroit : des disques décalés derrière la photo. */
  stacked: number;
  /** Rang d'apparition, pour faire éclore les repères l'un après l'autre. */
  order: number;
};

const SIZE = 54;

/** Repère photo de la balade : la reprise de 2026 dans un disque blanc, cerclé d'orange si actif. */
export function PhotoPin({ source, selected, stacked, order }: PhotoPinProps) {
  const appear = useSharedValue(0);
  const focus = useSharedValue(selected ? 1 : 0);

  useEffect(() => {
    appear.value = withDelay(350 + order * 140, withSpring(1, { damping: 12, stiffness: 160 }));
  }, [appear, order]);

  useEffect(() => {
    focus.value = withTiming(selected ? 1 : 0, { duration: 280 });
  }, [focus, selected]);

  const pinStyle = useAnimatedStyle(() => ({
    opacity: appear.value,
    transform: [{ scale: appear.value * (1 + focus.value * 0.22) }],
  }));
  const ringStyle = useAnimatedStyle(() => ({ opacity: focus.value }));

  return (
    <View style={styles.box} pointerEvents="none">
      <Animated.View style={pinStyle}>
        {Array.from({ length: Math.min(stacked, 2) }, (_, index) => (
          <View
            key={index}
            style={[styles.disc, styles.stackDisc, { transform: [{ translateX: 4 * (index + 1) }, { translateY: 4 * (index + 1) }] }]}
          />
        ))}
        <View style={styles.disc}>
          {source ? <Image source={source} style={styles.photo} contentFit="cover" transition={150} /> : null}
        </View>
        <Animated.View style={[styles.ring, ringStyle]} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { width: SIZE + 34, height: SIZE + 34, alignItems: 'center', justifyContent: 'center' },
  // L'anneau orange du repère actif, collé au disque : ni décalé, ni flottant autour.
  ring: {
    position: 'absolute',
    top: -5,
    left: -5,
    width: SIZE + 10,
    height: SIZE + 10,
    borderRadius: (SIZE + 10) / 2,
    borderWidth: 4,
    borderColor: Palette.goBright,
  },
  disc: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: 3,
    borderColor: Palette.white,
    backgroundColor: Palette.blueDeep,
    overflow: 'hidden',
    shadowColor: Palette.black,
    shadowOpacity: 0.35,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  stackDisc: { position: 'absolute', backgroundColor: Palette.white },
  photo: { width: '100%', height: '100%' },
});
