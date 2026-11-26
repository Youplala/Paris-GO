import * as Haptics from 'expo-haptics';
import { Image, type ImageSource } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { forwardRef, useCallback, useImperativeHandle, useRef } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View, type FlatList } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

import { Fonts, Palette, Spacing } from '@/constants/theme';

export type AlbumStep = {
  key: string;
  title: string;
  subtitle: string;
  current: ImageSource;
  reference?: ImageSource;
  referenceYear: number;
  currentYear: string;
};

export type StepCarouselHandle = { scrollToIndex: (index: number) => void };

type StepCarouselProps = {
  steps: readonly AlbumStep[];
  /** L'étape dont la carte montre la photo d'archive au lieu de la reprise. */
  archiveIndex?: number;
  onIndexChange: (index: number) => void;
  onToggleArchive: (index: number) => void;
  onOpen: (index: number) => void;
  /** Le doigt de l'utilisateur prend la main : la lecture automatique s'arrête. */
  onUserScroll?: () => void;
};

const CARD_HEIGHT = 196;
const GAP = 14;

export const StepCarousel = forwardRef<StepCarouselHandle, StepCarouselProps>(function StepCarousel(
  { steps, archiveIndex, onIndexChange, onToggleArchive, onOpen, onUserScroll },
  ref,
) {
  const { width } = useWindowDimensions();
  const cardWidth = Math.min(340, width - 92);
  const interval = cardWidth + GAP;
  const sidePadding = (width - cardWidth) / 2;
  const scrollX = useSharedValue(0);
  const listRef = useRef<FlatList<AlbumStep>>(null);
  const lastIndex = useRef(0);

  useImperativeHandle(ref, () => ({
    scrollToIndex: (index: number) => {
      lastIndex.current = index;
      listRef.current?.scrollToOffset({ offset: index * interval, animated: true });
    },
  }), [interval]);

  const onScroll = useAnimatedScrollHandler((event) => {
    scrollX.value = event.contentOffset.x;
  });

  const settle = useCallback(
    (offset: number) => {
      const index = Math.max(0, Math.min(steps.length - 1, Math.round(offset / interval)));
      if (index !== lastIndex.current) {
        lastIndex.current = index;
        void Haptics.selectionAsync();
        onIndexChange(index);
      }
    },
    [interval, onIndexChange, steps.length],
  );

  return (
    <Animated.FlatList
      ref={listRef as never}
      data={steps as AlbumStep[]}
      horizontal
      keyExtractor={(step) => step.key}
      showsHorizontalScrollIndicator={false}
      snapToInterval={interval}
      decelerationRate="fast"
      disableIntervalMomentum
      contentContainerStyle={{ paddingHorizontal: sidePadding, gap: GAP }}
      onScroll={onScroll}
      scrollEventThrottle={16}
      onScrollBeginDrag={onUserScroll}
      onMomentumScrollEnd={(event) => settle(event.nativeEvent.contentOffset.x)}
      getItemLayout={(_, index) => ({ index, length: interval, offset: interval * index })}
      renderItem={({ item, index }) => (
        <StepCard
          step={item}
          index={index}
          total={steps.length}
          width={cardWidth}
          interval={interval}
          scrollX={scrollX}
          showArchive={archiveIndex === index}
          onToggleArchive={() => onToggleArchive(index)}
          onOpen={() => onOpen(index)}
        />
      )}
    />
  );
});

type StepCardProps = {
  step: AlbumStep;
  index: number;
  total: number;
  width: number;
  interval: number;
  scrollX: SharedValue<number>;
  showArchive: boolean;
  onToggleArchive: () => void;
  onOpen: () => void;
};

function StepCard({ step, index, total, width, interval, scrollX, showArchive, onToggleArchive, onOpen }: StepCardProps) {
  const animated = useAnimatedStyle(() => {
    const distance = (scrollX.value - index * interval) / interval;
    return {
      opacity: interpolate(Math.abs(distance), [0, 1], [1, 0.55], 'clamp'),
      transform: [{ scale: interpolate(Math.abs(distance), [0, 1], [1, 0.9], 'clamp') }],
    };
  });
  const main = showArchive && step.reference ? step.reference : step.current;
  const inset = showArchive ? step.current : step.reference;

  return (
    <Animated.View style={[styles.card, { width }, animated]}>
      <Pressable
        accessibilityHint="Ouvre la comparaison de cette reprise"
        accessibilityLabel={`Étape ${index + 1} sur ${total}, ${step.title}, ${step.subtitle}`}
        accessibilityRole="button"
        onPress={onOpen}
        style={StyleSheet.absoluteFill}>
        <Image source={main} style={StyleSheet.absoluteFill} contentFit="cover" transition={380} />
        {SHADES.map((height) => (
          <View key={height} pointerEvents="none" style={[styles.shade, { height }]} />
        ))}
        <View style={[styles.yearPill, showArchive ? styles.yearArchive : styles.yearToday]}>
          <Text style={styles.yearText}>{showArchive ? step.referenceYear : step.currentYear}</Text>
        </View>
        <View style={styles.copy}>
          <Text style={styles.title} numberOfLines={1}>{step.title}</Text>
          <Text style={styles.subtitle} numberOfLines={1}>{step.subtitle}</Text>
        </View>
      </Pressable>
      {inset ? (
        <Pressable
          accessibilityLabel={showArchive ? 'Revoir la photo d’aujourd’hui' : `Voir la photo de ${step.referenceYear}`}
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onToggleArchive();
          }}
          style={({ pressed }) => [styles.inset, pressed && styles.insetPressed]}>
          <Image source={inset} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
          <View style={styles.insetBadge}>
            <SymbolView name="arrow.left.arrow.right" size={10} tintColor={Palette.white} />
            <Text style={styles.insetText}>{showArchive ? step.currentYear : step.referenceYear}</Text>
          </View>
        </Pressable>
      ) : null}
    </Animated.View>
  );
}

const SHADES = Array.from({ length: 10 }, (_, step) => Math.round(150 * (1 - step / 10)));

const styles = StyleSheet.create({
  card: {
    height: CARD_HEIGHT,
    borderRadius: 30,
    overflow: 'hidden',
    backgroundColor: Palette.blueDeep,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.22)',
  },
  shade: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(8, 17, 22, 0.1)' },
  yearPill: { position: 'absolute', top: Spacing.three, left: Spacing.three, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  yearArchive: { backgroundColor: Palette.copper },
  yearToday: { backgroundColor: Palette.parisBlue },
  yearText: { color: Palette.white, fontFamily: Fonts.display, fontWeight: '800', fontSize: 14, lineHeight: 17 },
  copy: { position: 'absolute', left: Spacing.threeHalf, right: Spacing.threeHalf, bottom: Spacing.threeHalf },
  title: { color: Palette.white, fontFamily: Fonts.display, fontWeight: '800', fontSize: 24, lineHeight: 27 },
  subtitle: { marginTop: 2, color: 'rgba(255, 255, 255, 0.86)', fontFamily: Fonts.sans, fontWeight: '600', fontSize: 14, lineHeight: 19 },
  inset: {
    position: 'absolute',
    top: Spacing.twoHalf,
    right: Spacing.twoHalf,
    width: 68,
    height: 52,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: Palette.white,
    backgroundColor: Palette.archive,
  },
  insetPressed: { opacity: 0.85, transform: [{ scale: 0.96 }] },
  insetBadge: {
    position: 'absolute',
    left: 4,
    bottom: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 999,
    backgroundColor: 'rgba(8, 17, 22, 0.72)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  insetText: { color: Palette.white, fontFamily: Fonts.display, fontWeight: '800', fontSize: 11, lineHeight: 13 },
});
