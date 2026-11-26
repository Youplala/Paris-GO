import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Fonts, Kicker, Palette, Radius, Shadow, Spacing, Typography } from '@/constants/theme';
import { useAlbumReferences } from '@/hooks/use-album-references';
import { albumStats, formatAlbumDay, summarizePlaces, type Album } from '@/services/albums';

type AlbumCardProps = {
  album: Album;
  title: string;
  onPress: () => void;
};

/** La balade dans le carnet : son premier avant/après en couverture, puis titre et chiffres. */
export function AlbumCard({ album, title, onPress }: AlbumCardProps) {
  const references = useAlbumReferences(album.captures);
  const first = album.captures[0];
  const firstReference = references.get(first.id);
  const stats = albumStats(album);
  const places = useMemo(() => {
    const labels: string[] = [];
    for (const capture of album.captures) {
      const label = references.get(capture.id)?.place ?? capture.stationId;
      if (!labels.includes(label)) labels.push(label);
    }
    return labels;
  }, [album.captures, references]);
  const meta = [
    `${stats.count} ${stats.count > 1 ? 'reprises' : 'reprise'}`,
    stats.distance,
    summarizePlaces(places),
  ].filter(Boolean).join(' · ');

  return (
    <Pressable
      accessibilityHint="Ouvre la balade"
      accessibilityLabel={`${title}, ${formatAlbumDay(album.id)}, ${meta}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.cover}>
        {firstReference?.image ? (
          <Image source={firstReference.image} style={styles.half} contentFit="cover" transition={200} />
        ) : (
          <View style={[styles.half, styles.placeholder]} />
        )}
        <Image source={{ uri: first.imageUri }} style={styles.half} contentFit="cover" transition={200} />
        <View style={styles.divider} />
        <View style={[styles.year, styles.yearLeft]}>
          <Text style={styles.yearText}>{firstReference?.year ?? 1970}</Text>
        </View>
        <View style={[styles.year, styles.yearRight]}>
          <Text style={styles.yearText}>{album.id.slice(0, 4)}</Text>
        </View>
      </View>
      <View style={styles.body}>
        <View style={styles.copy}>
          <Text style={styles.kicker}>{formatAlbumDay(album.id)}</Text>
          <Text style={styles.title} numberOfLines={2}>{title}</Text>
          <Text style={styles.meta} numberOfLines={2}>{meta}</Text>
        </View>
        <SymbolView name="chevron.right" size={14} tintColor={Palette.inkSoft} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: Spacing.three, borderRadius: Radius.large, overflow: 'hidden', backgroundColor: Palette.white, ...Shadow.card },
  pressed: { opacity: 0.92, transform: [{ scale: 0.99 }] },
  cover: { height: 180, flexDirection: 'row', backgroundColor: Palette.blueMist },
  half: { flex: 1, height: '100%' },
  placeholder: { backgroundColor: Palette.archive },
  divider: { position: 'absolute', top: 0, bottom: 0, left: '50%', width: 2, marginLeft: -1, backgroundColor: Palette.white },
  year: { position: 'absolute', top: Spacing.two, paddingHorizontal: Spacing.two, paddingVertical: Spacing.half, borderRadius: Radius.pill },
  yearLeft: { left: Spacing.two, backgroundColor: Palette.copper },
  yearRight: { right: Spacing.two, backgroundColor: Palette.parisBlue },
  yearText: { ...Typography.caption, color: Palette.white, fontFamily: Fonts.display, fontWeight: '700' },
  body: { padding: Spacing.three, flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  copy: { flex: 1 },
  kicker: { ...Kicker, color: Palette.go },
  title: { ...Typography.title, marginTop: Spacing.one, color: Palette.ink, fontFamily: Fonts.display, fontWeight: '800' },
  meta: { ...Typography.caption, marginTop: Spacing.one, color: Palette.inkSoft, fontFamily: Fonts.sans },
});
