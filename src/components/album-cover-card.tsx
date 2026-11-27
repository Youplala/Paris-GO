import { Image } from 'expo-image';
import { SymbolView } from '@/components/ui/symbol';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { YearPill } from '@/components/ui/year-pill';
import { Fonts, Kicker, Palette, Radius, Spacing } from '@/constants/theme';
import { useAlbumReferences } from '@/hooks/use-album-references';
import { albumStats, formatAlbumDay, summarizePlaces, type Album } from '@/services/albums';

type AlbumCoverCardProps = {
  album: Album;
  title: string;
  onPress: () => void;
  /** `compact` : vignette d'un carrousel (accueil) ; `full` : pleine largeur (carnet). */
  variant?: 'full' | 'compact';
  width?: number;
};

const SHADES = Array.from({ length: 10 }, (_, step) => 1 - step / 10);

/**
 * La balade comme une couverture de voyage : l'archive et la reprise côte à côte, plein cadre,
 * le titre posé sur la photo et les chiffres de la journée en pastilles.
 */
export function AlbumCoverCard({ album, title, onPress, variant = 'full', width }: AlbumCoverCardProps) {
  const references = useAlbumReferences(album.captures);
  const first = album.captures[0];
  const reference = references.get(first.id);
  const stats = albumStats(album);
  const places = useMemo(() => {
    const labels: string[] = [];
    for (const capture of album.captures) {
      const label = references.get(capture.id)?.place ?? capture.stationId;
      if (!labels.includes(label)) labels.push(label);
    }
    return labels;
  }, [album.captures, references]);
  const compact = variant === 'compact';
  const height = compact ? 196 : 248;
  const chips = [
    `${stats.count} ${stats.count > 1 ? 'photos' : 'photo'}`,
    stats.distance,
    compact ? undefined : summarizePlaces(places),
  ].filter(Boolean) as string[];

  return (
    <Pressable
      accessibilityHint="Ouvre la balade sur la carte"
      accessibilityLabel={`${title}, ${formatAlbumDay(album.id)}, ${chips.join(', ')}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.card, { height, width }, pressed && styles.pressed]}>
      <View style={styles.photos}>
        {reference?.image ? (
          <Image source={reference.image} style={styles.half} contentFit="cover" transition={250} />
        ) : (
          <View style={[styles.half, styles.placeholder]} />
        )}
        <Image source={{ uri: first.imageUri }} style={styles.half} contentFit="cover" transition={250} />
      </View>
      <View style={styles.divider} />
      {SHADES.map((step) => (
        <View key={step} pointerEvents="none" style={[styles.shade, { height: height * 0.62 * step }]} />
      ))}
      <YearPill label={reference?.year ?? 1970} tone="archive" style={[styles.year, styles.yearLeft]} />
      <YearPill label={album.id.slice(0, 4)} tone="today" style={[styles.year, styles.yearRight]} />
      <View style={styles.copy}>
        <Text style={styles.kicker} numberOfLines={1}>{formatAlbumDay(album.id)}</Text>
        <View style={styles.titleRow}>
          <Text style={[styles.title, compact && styles.titleCompact]} numberOfLines={compact ? 1 : 2}>
            {title}
          </Text>
          {compact ? null : (
            <View style={styles.go}>
              <SymbolView name="map.fill" size={14} tintColor={Palette.white} />
            </View>
          )}
        </View>
        <View style={styles.chips}>
          {chips.map((chip) => (
            <View key={chip} style={styles.chip}>
              <Text style={styles.chipText} numberOfLines={1}>{chip}</Text>
            </View>
          ))}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: Radius.large, overflow: 'hidden', backgroundColor: Palette.blueDeep },
  pressed: { opacity: 0.94, transform: [{ scale: 0.985 }] },
  photos: { ...StyleSheet.absoluteFill, flexDirection: 'row' },
  half: { flex: 1, height: '100%' },
  placeholder: { backgroundColor: Palette.archive },
  divider: { position: 'absolute', top: 0, bottom: 0, left: '50%', width: 2, marginLeft: -1, backgroundColor: 'rgba(255,255,255,0.85)' },
  shade: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(8, 17, 22, 0.085)' },
  year: { position: 'absolute', top: Spacing.twoHalf },
  yearLeft: { left: Spacing.twoHalf },
  yearRight: { right: Spacing.twoHalf },
  copy: { position: 'absolute', left: Spacing.three, right: Spacing.three, bottom: Spacing.three },
  kicker: { ...Kicker, color: Palette.brass },
  titleRow: { marginTop: 2, flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.two },
  title: { flex: 1, color: Palette.white, fontFamily: Fonts.display, fontWeight: '800', fontSize: 28, lineHeight: 31 },
  titleCompact: { fontSize: 22, lineHeight: 25 },
  go: { width: 34, height: 34, marginBottom: 1, borderRadius: 17, backgroundColor: Palette.go, alignItems: 'center', justifyContent: 'center' },
  chips: { marginTop: Spacing.two, flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one },
  chip: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: Radius.pill, backgroundColor: 'rgba(255, 255, 255, 0.18)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.35)', maxWidth: '100%' },
  chipText: { color: Palette.white, fontFamily: Fonts.sans, fontWeight: '700', fontSize: 13, lineHeight: 18 },
});
