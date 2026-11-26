import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { GlassBackdrop } from '@/components/glass-icon-button';
import { Fonts, Palette } from '@/constants/theme';

type StepScrubberProps = {
  count: number;
  index: number;
  width: number;
  /** Appelé à chaque étape franchie pendant le glissé, puis au relâché. */
  onChange: (index: number) => void;
  /** Le doigt prend la main : la lecture automatique s'arrête. */
  onScrubStart?: () => void;
};

const THUMB_WIDTH = 58;
const THUMB_HEIGHT = 32;
const SPRING = { damping: 18, stiffness: 220, mass: 0.7 };

/**
 * Curseur des étapes de la balade : on le fait glisser pour parcourir les reprises, il se cale
 * sur chaque étape, et suit en douceur le carrousel ou la lecture automatique.
 */
export function StepScrubber({ count, index, width, onChange, onScrubStart }: StepScrubberProps) {
  const travel = Math.max(1, width - THUMB_WIDTH);
  const lastStep = Math.max(1, count - 1);
  const position = useSharedValue((index / lastStep) * travel);
  const pressed = useSharedValue(0);
  const dragStart = useSharedValue(0);
  const liveStep = useSharedValue(index);
  // Pendant le glissé, l'étiquette suit le doigt ; sinon elle montre l'étape choisie.
  const [dragStep, setDragStep] = useState<number>();
  const label = dragStep ?? index;

  // Hors glissé, le curseur rejoint l'étape choisie ailleurs (carrousel, repère, lecture).
  useEffect(() => {
    if (pressed.get()) return;
    liveStep.set(index);
    position.set(withSpring((index / lastStep) * travel, SPRING));
  }, [index, lastStep, liveStep, position, pressed, travel]);

  const notifyStep = (step: number) => {
    setDragStep(step);
    void Haptics.selectionAsync();
    onChange(step);
  };
  const end = () => setDragStep(undefined);
  const begin = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onScrubStart?.();
  };

  const pan = Gesture.Pan()
    .hitSlop({ vertical: 14 })
    .onBegin(() => {
      pressed.set(withTiming(1, { duration: 120 }));
      dragStart.set(position.get());
      runOnJS(begin)();
    })
    .onUpdate((event) => {
      const next = Math.min(travel, Math.max(0, dragStart.get() + event.translationX));
      position.set(next);
      const step = Math.round((next / travel) * lastStep);
      if (step !== liveStep.get()) {
        liveStep.set(step);
        runOnJS(notifyStep)(step);
      }
    })
    .onFinalize(() => {
      pressed.set(withTiming(0, { duration: 160 }));
      position.set(withSpring((liveStep.get() / lastStep) * travel, SPRING));
      runOnJS(end)();
    });

  // Un toucher sur la piste saute à l'étape la plus proche.
  const tap = Gesture.Tap().onEnd((event) => {
    const step = Math.round((Math.min(travel, Math.max(0, event.x - THUMB_WIDTH / 2)) / travel) * lastStep);
    position.set(withSpring((step / lastStep) * travel, SPRING));
    if (step !== liveStep.get()) {
      liveStep.set(step);
      runOnJS(notifyStep)(step);
      runOnJS(end)();
    }
  });

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: position.get() }, { scale: 1 + pressed.get() * 0.08 }],
  }));
  const fillStyle = useAnimatedStyle(() => ({ width: position.get() + THUMB_WIDTH / 2 }));

  return (
    <GestureDetector gesture={Gesture.Exclusive(pan, tap)}>
      <View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel="Étape de la balade"
        accessibilityValue={{ min: 1, max: count, now: label + 1, text: `${label + 1} sur ${count}` }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(event) => {
          const step = event.nativeEvent.actionName === 'increment' ? Math.min(count - 1, index + 1) : Math.max(0, index - 1);
          if (step !== index) onChange(step);
        }}
        style={[styles.root, { width }]}>
        <View style={styles.track} />
        <Animated.View style={[styles.fill, fillStyle]} />
        {Array.from({ length: count }, (_, step) => (
          <View
            key={step}
            pointerEvents="none"
            style={[styles.tick, { left: THUMB_WIDTH / 2 + (step / lastStep) * travel - 2 }]}
          />
        ))}
        <Animated.View style={[styles.thumb, thumbStyle]}>
          <GlassBackdrop radius={THUMB_HEIGHT / 2} />
          <Text style={styles.label}>
            {label + 1}/{count}
          </Text>
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  root: { alignSelf: 'center', height: 44, justifyContent: 'center' },
  track: { position: 'absolute', left: 0, right: 0, height: 5, borderRadius: 2.5, backgroundColor: 'rgba(255, 255, 255, 0.25)' },
  fill: { position: 'absolute', left: 0, height: 5, borderRadius: 2.5, backgroundColor: Palette.goBright },
  tick: { position: 'absolute', width: 4, height: 4, borderRadius: 2, backgroundColor: 'rgba(255, 255, 255, 0.7)' },
  thumb: {
    position: 'absolute',
    left: 0,
    width: THUMB_WIDTH,
    height: THUMB_HEIGHT,
    borderRadius: THUMB_HEIGHT / 2,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  label: { color: Palette.white, fontFamily: Fonts.display, fontWeight: '800', fontSize: 16, lineHeight: 19, fontVariant: ['tabular-nums'] },
});
