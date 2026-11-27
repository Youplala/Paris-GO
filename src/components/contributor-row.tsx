import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ContributorAvatar } from '@/components/contributor-avatar';
import { Fonts, HitSize, Palette, Radius, Spacing, Typography } from '@/constants/theme';
import type { StationDetail } from '@/types/station';

type ContributorRowProps = {
  /** Nom affiché (« Martin de P. »). */
  displayName: string;
  count: number;
  /** Ses dernières photos, montrées en vignettes pour les reconnaître d'un coup d'œil. */
  photos?: readonly StationDetail[];
  onOpen: () => void;
  onOpenPhoto?: (photo: StationDetail) => void;
};

export function photoCountLabel(count: number) {
  return `${count.toLocaleString('fr-FR')} ${count > 1 ? 'photos refaites' : 'photo refaite'}`;
}

/** Une personne de la communauté : qui, combien, et ses dernières photos. */
export function ContributorRow({ displayName, count, photos = [], onOpen, onOpenPhoto }: ContributorRowProps) {
  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Voir les photos de ${displayName}, ${photoCountLabel(count)}`}
        onPress={onOpen}
        style={({ pressed }) => [styles.head, pressed && styles.pressed]}>
        <ContributorAvatar name={displayName} />
        <View style={styles.copy}>
          <Text style={styles.name} numberOfLines={1}>{displayName}</Text>
          <Text style={styles.meta}>{photoCountLabel(count)}</Text>
        </View>
        <SymbolView name="chevron.right" size={14} tintColor={Palette.inkSoft} />
      </Pressable>
      {photos.length ? (
        <View style={styles.thumbs}>
          {photos.slice(0, 4).map((photo) => (
            <Pressable
              key={photo.id}
              accessibilityRole="button"
              accessibilityLabel={`Ouvrir la photo ${photo.name}`}
              onPress={() => (onOpenPhoto ? onOpenPhoto(photo) : onOpen())}
              style={({ pressed }) => [styles.thumb, pressed && styles.pressed]}>
              {photo.recaptureImage ? (
                <Image source={photo.recaptureImage} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
              ) : null}
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { paddingVertical: Spacing.twoHalf, paddingHorizontal: Spacing.three, backgroundColor: Palette.white, gap: Spacing.two },
  head: { minHeight: HitSize, flexDirection: 'row', alignItems: 'center', gap: Spacing.twoHalf },
  copy: { flex: 1 },
  name: { ...Typography.title, color: Palette.ink, fontFamily: Fonts.display, fontWeight: '800' },
  meta: { ...Typography.caption, color: Palette.inkSoft, fontFamily: Fonts.sans },
  thumbs: { flexDirection: 'row', gap: Spacing.two },
  thumb: { width: '23%', aspectRatio: 1, borderRadius: Radius.small, overflow: 'hidden', backgroundColor: Palette.archive },
  pressed: { opacity: 0.75 },
});
