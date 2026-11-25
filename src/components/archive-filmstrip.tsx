import type { ImageSource } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { useEffect, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AdaptivePhoto } from '@/components/adaptive-photo';
import { Fonts, Palette, Radius, Spacing, Typography } from '@/constants/theme';

type ArchiveFilmstripProps = {
  images: readonly ImageSource[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  recaptureCounts?: readonly number[];
  /** Vignettes à montrer, dans l'ordre de la planche ; toutes par défaut. */
  visibleIndices?: readonly number[];
};

// Des vignettes assez grandes pour reconnaître une rue, assez petites pour que la photo du haut,
// la pellicule et la fiche tiennent ensemble dans le premier écran.
const FRAME_WIDTH = 112;
const FRAME_HEIGHT = 80;

export function ArchiveFilmstrip({
  images,
  selectedIndex,
  onSelect,
  recaptureCounts,
  visibleIndices,
}: ArchiveFilmstripProps) {
  const scrollRef = useRef<ScrollView>(null);
  const indices = visibleIndices ?? images.map((_, index) => index);
  const selectedPosition = indices.indexOf(selectedIndex);

  useEffect(() => {
    if (selectedPosition < 0) return;
    const frame = requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({
        animated: true,
        x: Math.max(0, selectedPosition * (FRAME_WIDTH + Spacing.two) - FRAME_WIDTH),
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [selectedPosition]);

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.content}>
      {indices.map((index) => {
        const image = images[index];
        if (!image) return null;
        // Seules les photos refaites portent une marque : « à retrouver » est le cas courant,
        // l'écrire sur chaque vignette noyait les quelques reprises existantes.
        const done = (recaptureCounts?.[index] ?? 0) > 0;
        return (
          <Pressable
            key={index}
            accessibilityLabel={`Voir la photo ${index + 1} du secteur${recaptureCounts ? (done ? ', déjà refaite' : ', aucune reprise identifiée') : ''}`}
            accessibilityState={{ selected: selectedIndex === index }}
            accessibilityRole="button"
            onPress={() => onSelect(index)}
            style={[styles.frame, selectedIndex === index && styles.selectedFrame]}>
            <AdaptivePhoto source={image} style={styles.image} blurRadius={10} />
            {done ? (
              <View style={styles.doneBadge}>
                <SymbolView name="checkmark" size={11} weight="heavy" tintColor={Palette.black} />
              </View>
            ) : null}
            <View style={styles.number}>
              <Text style={styles.numberText}>{String(index + 1).padStart(2, '0')}</Text>
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  doneBadge: {
    position: 'absolute',
    top: Spacing.one,
    right: Spacing.one,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Palette.brass,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  frame: {
    width: FRAME_WIDTH,
    height: FRAME_HEIGHT,
    borderRadius: Radius.small,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: Palette.archive,
  },
  selectedFrame: {
    borderColor: Palette.brass,
    borderWidth: 3,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  number: {
    position: 'absolute',
    bottom: Spacing.one,
    left: Spacing.one,
    minWidth: 28,
    paddingHorizontal: Spacing.one,
    paddingVertical: Spacing.half,
    borderRadius: Radius.small,
    backgroundColor: 'rgba(8, 17, 22, 0.76)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberText: {
    ...Typography.caption,
    color: Palette.white,
    fontFamily: Fonts.display,
    fontWeight: '700',
  },
});
