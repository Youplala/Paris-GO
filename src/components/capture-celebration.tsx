import * as Haptics from 'expo-haptics';
import { Image, type ImageSource } from 'expo-image';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { Fonts, Kicker, Palette, Spacing } from '@/constants/theme';

type CaptureCelebrationProps = {
  before: ImageSource;
  after: ImageSource;
  fromYear: number;
  toYear: number;
  /** « Secteur 995 · photo 7 ». */
  place: string;
  onDone: () => void;
};

const REVEAL_DELAY = 450;
const REVEAL_MS = 1500;
const BURST_AT = REVEAL_DELAY + REVEAL_MS - 80;
const EXIT_AT = BURST_AT + 1700;
const PARTICLE_COLORS = [Palette.goBright, Palette.brass, Palette.white, Palette.parisBlue, Palette.copper];
const PARTICLE_COUNT = 56;

type Particle = { angle: number; distance: number; size: number; color: string; spin: number; round: boolean; delay: number };

/** Des éclats répartis tout autour du trait de révélation, différents d'une photo à l'autre. */
function makeParticles(seed: number): Particle[] {
  let state = seed || 1;
  const random = () => {
    state = (state * 16807) % 2147483647;
    return state / 2147483647;
  };
  return Array.from({ length: PARTICLE_COUNT }, (_, index) => ({
    angle: (index / PARTICLE_COUNT) * Math.PI * 2 + random() * 0.4,
    distance: 150 + random() * 230,
    size: 9 + random() * 11,
    color: PARTICLE_COLORS[index % PARTICLE_COLORS.length],
    spin: (random() - 0.5) * 900,
    round: random() > 0.55,
    delay: random() * 90,
  }));
}

function Confetti({ particle, burst }: { particle: Particle; burst: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const p = burst.get();
    return {
      opacity: p <= 0 ? 0 : Math.max(0, 1 - p * p),
      transform: [
        { translateX: Math.cos(particle.angle) * particle.distance * p },
        // Un peu de gravité : les éclats retombent en fin de course.
        { translateY: Math.sin(particle.angle) * particle.distance * p + 140 * p * p },
        { rotate: `${particle.spin * p}deg` },
        { scale: 0.4 + p * 0.8 },
      ],
    };
  });
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.particle,
        {
          width: particle.size,
          height: particle.round ? particle.size : particle.size * 0.55,
          borderRadius: particle.round ? particle.size / 2 : 2,
          backgroundColor: particle.color,
        },
        style,
      ]}
    />
  );
}

/**
 * Le moment qui récompense la marche : la photo de 1970 se développe en celle d'aujourd'hui sous
 * un trait de lumière, l'année défile jusqu'à aujourd'hui, puis éclats et bravo. Un toucher passe.
 */
export function CaptureCelebration({ before, after, fromYear, toYear, place, onDone }: CaptureCelebrationProps) {
  const { width, height } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const reveal = useSharedValue(0);
  const burst = useSharedValue(0);
  const titleIn = useSharedValue(0);
  const exit = useSharedValue(0);
  const flash = useSharedValue(0);
  const [year, setYear] = useState(fromYear);
  // La séquence attend que les deux photos soient affichables : un trait de lumière sur du noir
  // ne raconte rien. Au-delà de trois secondes, elle part quand même.
  const [loaded, setLoaded] = useState({ before: false, after: false });
  const [waited, setWaited] = useState(false);
  const ready = (loaded.before && loaded.after) || waited;
  useEffect(() => {
    const timer = setTimeout(() => setWaited(true), 3000);
    return () => clearTimeout(timer);
  }, []);
  // Graine tirée du lieu : chaque photo a sa gerbe, stable d'un rendu à l'autre.
  const particles = useMemo(
    () => makeParticles([...place].reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) % 2147483647, 7)),
    [place],
  );

  const finish = () => onDone();
  const tick = () => void Haptics.selectionAsync();
  const success = () => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

  useEffect(() => {
    if (!ready) return;
    if (reducedMotion) {
      reveal.set(withTiming(1, { duration: 500 }));
      titleIn.set(withDelay(300, withTiming(1, { duration: 300 })));
      exit.set(withDelay(1600, withTiming(1, { duration: 350 }, (done) => { if (done) runOnJS(finish)(); })));
      return;
    }
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    reveal.set(withDelay(REVEAL_DELAY, withTiming(1, { duration: REVEAL_MS, easing: Easing.inOut(Easing.cubic) })));
    burst.set(withDelay(BURST_AT, withTiming(1, { duration: 1400, easing: Easing.out(Easing.cubic) })));
    // Un éclair bref quand la photo d'aujourd'hui est entièrement révélée, comme un flash.
    flash.set(withDelay(BURST_AT - 40, withSequence(withTiming(0.55, { duration: 90 }), withTiming(0, { duration: 420 }))));
    titleIn.set(withDelay(BURST_AT - 60, withSpring(1, { damping: 11, stiffness: 140 })));
    exit.set(withDelay(EXIT_AT, withTiming(1, { duration: 450, easing: Easing.in(Easing.quad) }, (done) => {
      if (done) runOnJS(finish)();
    })));
    // `finish` change à chaque rendu mais ne fait qu'appeler `onDone` : la séquence ne se joue qu'une fois.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  // L'année défile avec le trait ; un petit retour haptique tous les dix ans, un succès à l'arrivée.
  useAnimatedReaction(
    () => Math.round(fromYear + reveal.get() * (toYear - fromYear)),
    (current, previous) => {
      if (current === previous) return;
      runOnJS(setYear)(current);
      if (previous !== null && Math.floor(current / 10) !== Math.floor(previous / 10)) runOnJS(tick)();
      if (current === toYear) runOnJS(success)();
    },
  );

  const afterClip = useAnimatedStyle(() => ({ width: reveal.get() * width }));
  const lineStyle = useAnimatedStyle(() => ({
    opacity: reveal.get() > 0.005 && reveal.get() < 0.995 ? 1 : 0,
    transform: [{ translateX: reveal.get() * width - 2 }],
  }));
  const yearStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + 0.08 * Math.sin(reveal.get() * Math.PI) }],
  }));
  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleIn.get(),
    transform: [{ translateY: (1 - titleIn.get()) * 24 }, { scale: 0.85 + titleIn.get() * 0.15 }],
  }));
  const flashStyle = useAnimatedStyle(() => ({ opacity: flash.get() }));
  const rootStyle = useAnimatedStyle(() => ({
    opacity: 1 - exit.get(),
    transform: [{ scale: 1 + exit.get() * 0.06 }],
  }));

  const skip = () => {
    exit.set(withSequence(withTiming(1, { duration: 220 }, (done) => { if (done) runOnJS(finish)(); })));
  };

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.root, rootStyle]}>
      <Pressable accessibilityLabel="Passer l’animation" accessibilityRole="button" onPress={skip} style={StyleSheet.absoluteFill}>
        <Image
          source={before}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={400}
          onLoad={() => setLoaded((current) => ({ ...current, before: true }))}
          onError={() => setLoaded((current) => ({ ...current, before: true }))}
        />
        <Animated.View style={[styles.afterClip, { height }, afterClip]}>
          <Image
            source={after}
            style={{ width, height }}
            contentFit="cover"
            onLoad={() => setLoaded((current) => ({ ...current, after: true }))}
            onError={() => setLoaded((current) => ({ ...current, after: true }))}
          />
        </Animated.View>
        <Animated.View pointerEvents="none" style={[styles.line, { height }, lineStyle]} />
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.flash, flashStyle]} />
        {SHADES.map((step) => (
          <View key={step} pointerEvents="none" style={[styles.shade, { height: height * 0.55 * step }]} />
        ))}
        <View pointerEvents="none" style={[styles.burstOrigin, { top: height * 0.42 }]}>
          {particles.map((particle, index) => (
            <Confetti key={index} particle={particle} burst={burst} />
          ))}
        </View>
        <View pointerEvents="none" style={styles.copy}>
          <Animated.Text style={[styles.year, yearStyle]}>{year}</Animated.Text>
          <Animated.View style={titleStyle}>
            <Text style={styles.kicker}>{toYear - fromYear} ANS PLUS TARD</Text>
            <Text style={styles.title}>Bravo, c’est refait !</Text>
            <Text style={styles.place}>{place}</Text>
          </Animated.View>
        </View>
        <Text style={styles.skip}>Toucher pour continuer</Text>
      </Pressable>
    </Animated.View>
  );
}

const SHADES = Array.from({ length: 10 }, (_, step) => 1 - step / 10);

const styles = StyleSheet.create({
  root: { backgroundColor: Palette.black, zIndex: 50 },
  afterClip: { position: 'absolute', top: 0, left: 0, overflow: 'hidden' },
  line: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 4,
    backgroundColor: Palette.white,
    shadowColor: Palette.brass,
    shadowOpacity: 1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
  },
  shade: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(8, 17, 22, 0.09)' },
  burstOrigin: { position: 'absolute', left: '50%', width: 0, height: 0 },
  particle: { position: 'absolute' },
  flash: { backgroundColor: Palette.white },
  copy: { position: 'absolute', left: Spacing.four, right: Spacing.four, bottom: 96, alignItems: 'center' },
  year: {
    color: Palette.white,
    fontFamily: Fonts.display,
    fontWeight: '900',
    fontSize: 96,
    // Les chiffres de l'Avenir Next Condensed débordent au-dessus de la taille nominale :
    // une hauteur de ligne serrée les coupait en haut.
    lineHeight: 122,
    paddingTop: 6,
    fontVariant: ['tabular-nums'],
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowRadius: 16,
  },
  kicker: { ...Kicker, marginTop: Spacing.one, color: Palette.brass, textAlign: 'center' },
  title: { marginTop: Spacing.one, color: Palette.white, fontFamily: Fonts.display, fontWeight: '800', fontSize: 36, lineHeight: 40, textAlign: 'center' },
  place: { marginTop: Spacing.one, color: 'rgba(255,255,255,0.85)', fontFamily: Fonts.sans, fontWeight: '600', fontSize: 16, lineHeight: 21, textAlign: 'center' },
  skip: { position: 'absolute', bottom: 40, alignSelf: 'center', color: 'rgba(255,255,255,0.6)', fontFamily: Fonts.sans, fontWeight: '600', fontSize: 13 },
});
