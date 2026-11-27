import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from '@/components/ui/symbol';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';

import { ProgressBar } from '@/components/progress-bar';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Fonts, Palette, Radius, Shadow, Spacing, Typography } from '@/constants/theme';
import { useBhvpImages } from '@/hooks/use-bhvp-images';
import { useStations } from '@/providers/stations-provider';
import type { PhotographerSector } from '@/services/archive-photographers';
import { archiveLinkForImage } from '@/services/bhvp-images';
import { formatContributorName } from '@/utils/community-stats';

const THUMB_LIMIT = 8;
const STREET_LIMIT = 10;

function initialsFor(name: string) {
  return name
    .split(/[\s.-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase('fr-FR'))
    .join('');
}

/** Un secteur du photographe : ses vues de 1970 en vignettes, les refaites cochées. */
function SectorCard({ sector, onOpen }: { sector: PhotographerSector; onOpen: (frameIndex: number) => void }) {
  const links = useMemo(() => sector.frames.slice(0, THUMB_LIMIT).map((frame) => frame.link), [sector.frames]);
  const { images, loading } = useBhvpImages(links);
  const imageByLink = new Map(images.map((image) => [archiveLinkForImage(image), image]));
  const rest = sector.frames.length - THUMB_LIMIT;

  return (
    <View style={styles.sector}>
      <Pressable
        accessibilityHint="Ouvre le secteur sur sa première photo de ce photographe"
        accessibilityRole="button"
        onPress={() => onOpen(sector.frames[0].frameIndex)}
        style={({ pressed }) => [styles.sectorHead, pressed && styles.pressedSoft]}>
        <View style={styles.sectorCopy}>
          <Text style={styles.sectorTitle}>Secteur {sector.name}</Text>
          <Text style={styles.sectorMeta}>
            {sector.frames.length} {sector.frames.length > 1 ? 'photos' : 'photo'}
            {sector.recapturedCount ? ` · ${sector.recapturedCount} ${sector.recapturedCount > 1 ? 'refaites' : 'refaite'}` : ' · à retrouver'}
          </Text>
        </View>
        <SymbolView name="chevron.right" size={13} tintColor={Palette.inkSoft} />
      </Pressable>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbs}>
        {sector.frames.slice(0, THUMB_LIMIT).map((frame, index) => {
          const image = imageByLink.get(frame.link);
          const done = frame.recaptures.length > 0;
          return (
            <Pressable
              key={frame.link}
              accessibilityLabel={`Photo ${frame.frameIndex + 1} du secteur ${sector.name}${done ? ', déjà refaite' : ', à retrouver'}`}
              accessibilityRole="button"
              onPress={() => onOpen(frame.frameIndex)}
              style={({ pressed }) => [styles.thumb, pressed && styles.pressedSoft]}>
              {image ? (
                <Image source={image} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
              ) : (
                <View style={[StyleSheet.absoluteFill, styles.thumbPlaceholder, loading && { opacity: 0.6 }]} />
              )}
              {done ? (
                <View style={styles.thumbDone}>
                  <SymbolView name="checkmark" size={10} weight="heavy" tintColor={Palette.black} />
                </View>
              ) : null}
              <View style={styles.thumbNumber}>
                <Text style={styles.thumbNumberText}>{String(frame.frameIndex + 1).padStart(2, '0')}</Text>
              </View>
              {index === THUMB_LIMIT - 1 && rest > 0 ? (
                <View style={styles.thumbMore}>
                  <Text style={styles.thumbMoreText}>+{rest}</Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

/**
 * Profil d'un photographe du concours de 1970, comme celui des contributeurs d'aujourd'hui :
 * ses secteurs, ses photos, ce que la campagne en a déjà refait et qui l'a refait.
 */
export function PhotographerScreen() {
  const router = useRouter();
  const { name } = useLocalSearchParams<{ name?: string }>();
  const { findArchivePhotographer } = useStations();
  const profile = useMemo(() => (name ? findArchivePhotographer(name) : undefined), [findArchivePhotographer, name]);

  const region = useMemo(() => {
    if (!profile?.sectors.length) return undefined;
    const lats = profile.sectors.map((sector) => sector.coordinate.latitude);
    const lons = profile.sectors.map((sector) => sector.coordinate.longitude);
    return {
      latitude: (Math.min(...lats) + Math.max(...lats)) / 2,
      longitude: (Math.min(...lons) + Math.max(...lons)) / 2,
      latitudeDelta: Math.max(0.012, (Math.max(...lats) - Math.min(...lats)) * 1.8),
      longitudeDelta: Math.max(0.012, (Math.max(...lons) - Math.min(...lons)) * 1.8),
    };
  }, [profile]);

  const openFrame = (squareId: string, frameIndex: number) => {
    void Haptics.selectionAsync();
    router.push({ pathname: '/station/[id]', params: { id: squareId, frame: String(frameIndex) } });
  };

  return (
    <View style={styles.screen}>
      <ScreenHeader
        kicker="Photographe de 1970"
        title={profile?.displayName ?? 'Photographe'}
        onBack={() => router.back()}
      />

      {!profile ? (
        <View style={styles.empty}>
          <SymbolView name="person.crop.square" size={30} tintColor={Palette.copper} />
          <Text style={styles.emptyTitle}>Photographe introuvable</Text>
          <Text style={styles.emptyCopy}>Les notices de la BHVP ne citent pas ce nom dans le relevé actuel.</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          <Text style={styles.lead}>
            {profile.photoCount.toLocaleString('fr-FR')} {profile.photoCount > 1 ? 'photos' : 'photo'} ·{' '}
            {profile.sectors.length} {profile.sectors.length > 1 ? 'secteurs' : 'secteur'}
            {profile.candidateNumbers.length ? ` · candidat n° ${profile.candidateNumbers.join(', ')}` : ''}
          </Text>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              {profile.recapturedCount
                ? `${profile.recapturedCount} de ses ${profile.photoCount} photos ${profile.recapturedCount > 1 ? 'ont déjà été refaites' : 'a déjà été refaite'}`
                : 'Aucune de ses photos n’a encore été refaite'}
            </Text>
            <ProgressBar percentage={(profile.recapturedCount / Math.max(1, profile.photoCount)) * 100} height={8} />
          </View>

          {region ? (
            <View style={styles.mapWrap}>
              <MapView
                style={StyleSheet.absoluteFill}
                initialRegion={region}
                mapType="mutedStandard"
                pitchEnabled={false}
                rotateEnabled={false}
                scrollEnabled={false}
                zoomEnabled={false}
                pointerEvents="none">
                {profile.sectors.map((sector) => (
                  <Marker key={sector.squareId} coordinate={sector.coordinate} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
                    <View style={[styles.mapDot, sector.recapturedCount > 0 && styles.mapDotDone]}>
                      <Text style={styles.mapDotText}>{sector.frames.length}</Text>
                    </View>
                  </Marker>
                ))}
              </MapView>
              <View pointerEvents="none" style={styles.mapLegend}>
                <Text style={styles.mapLegendText}>SES SECTEURS SUR LA CARTE</Text>
              </View>
            </View>
          ) : null}

          {profile.streets.length ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Rues de ses reportages</Text>
              <View style={styles.chips}>
                {profile.streets.slice(0, STREET_LIMIT).map((street) => (
                  <View key={street} style={styles.chip}>
                    <Text style={styles.chipText}>{street}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Ses secteurs</Text>
            {profile.sectors.map((sector) => (
              <SectorCard key={sector.squareId} sector={sector} onOpen={(frameIndex) => openFrame(sector.squareId, frameIndex)} />
            ))}
          </View>

          {profile.recapturedBy.length ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Refaites par</Text>
              <View style={styles.chips}>
                {profile.recapturedBy.map((contributor) => (
                  <Pressable
                    key={contributor.name}
                    accessibilityRole="link"
                    onPress={() => {
                      void Haptics.selectionAsync();
                      router.push({ pathname: '/contributor/[name]', params: { name: contributor.name } });
                    }}
                    style={({ pressed }) => [styles.person, pressed && styles.pressedSoft]}>
                    <View style={styles.personAvatar}>
                      <Text style={styles.personAvatarText}>{initialsFor(formatContributorName(contributor.name))}</Text>
                    </View>
                    <Text style={styles.personName}>{formatContributorName(contributor.name)}</Text>
                    <Text style={styles.personCount}>{contributor.count}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}

          <Text style={styles.credit}>
            Notices et photographies : Bibliothèque historique de la Ville de Paris, fonds « C’était Paris en 1970 ».
            Les photographies restent sous le droit d’auteur de leurs photographes.
          </Text>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Palette.fog },
  content: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.six },
  card: { marginTop: Spacing.three, padding: Spacing.three, gap: Spacing.two, borderRadius: Radius.large, backgroundColor: Palette.white, ...Shadow.card },
  lead: { ...Typography.body, color: Palette.inkSoft, fontFamily: Fonts.sans, fontWeight: '600' },
  cardTitle: { ...Typography.body, flex: 1, color: Palette.ink, fontFamily: Fonts.sans, fontWeight: '700' },
  mapWrap: { marginTop: Spacing.three, height: 190, borderRadius: Radius.large, overflow: 'hidden', backgroundColor: Palette.blueMist },
  mapDot: { minWidth: 26, height: 26, paddingHorizontal: 5, borderRadius: 13, backgroundColor: Palette.copper, borderWidth: 2, borderColor: Palette.white, alignItems: 'center', justifyContent: 'center' },
  mapDotDone: { backgroundColor: Palette.parisBlue },
  mapDotText: { color: Palette.white, fontFamily: Fonts.display, fontWeight: '800', fontSize: 12, lineHeight: 15 },
  mapLegend: { position: 'absolute', left: Spacing.two, top: Spacing.two, paddingHorizontal: Spacing.two, paddingVertical: Spacing.one, borderRadius: Radius.pill, backgroundColor: 'rgba(255,255,255,0.92)' },
  mapLegendText: { ...Typography.caption, color: Palette.inkSoft, fontFamily: Fonts.display, fontWeight: '700', letterSpacing: 0.5 },
  section: { marginTop: Spacing.four, gap: Spacing.twoHalf },
  sectionTitle: { ...Typography.title, color: Palette.ink, fontFamily: Fonts.display, fontWeight: '800' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: { paddingHorizontal: Spacing.twoHalf, paddingVertical: Spacing.one + 2, borderRadius: Radius.pill, backgroundColor: Palette.white, borderWidth: StyleSheet.hairlineWidth, borderColor: Palette.line },
  chipText: { ...Typography.caption, color: Palette.ink, fontFamily: Fonts.sans, fontWeight: '600' },
  sector: { borderRadius: Radius.large, backgroundColor: Palette.white, paddingVertical: Spacing.twoHalf, ...Shadow.card },
  sectorHead: { paddingHorizontal: Spacing.three, flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  sectorCopy: { flex: 1 },
  sectorTitle: { ...Typography.body, color: Palette.ink, fontFamily: Fonts.display, fontWeight: '800', fontSize: 19 },
  sectorMeta: { ...Typography.caption, color: Palette.inkSoft, fontFamily: Fonts.sans },
  thumbs: { paddingHorizontal: Spacing.three, paddingTop: Spacing.twoHalf, gap: Spacing.two },
  thumb: { width: 96, height: 72, borderRadius: Radius.small, overflow: 'hidden', backgroundColor: Palette.archive },
  thumbPlaceholder: { backgroundColor: Palette.archive },
  thumbDone: { position: 'absolute', top: 4, right: 4, width: 18, height: 18, borderRadius: 9, backgroundColor: Palette.brass, alignItems: 'center', justifyContent: 'center' },
  thumbNumber: { position: 'absolute', left: 4, bottom: 4, paddingHorizontal: 4, borderRadius: 6, backgroundColor: 'rgba(8, 17, 22, 0.72)' },
  thumbNumberText: { color: Palette.white, fontFamily: Fonts.display, fontWeight: '700', fontSize: 11, lineHeight: 15 },
  thumbMore: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(8, 17, 22, 0.55)', alignItems: 'center', justifyContent: 'center' },
  thumbMoreText: { color: Palette.white, fontFamily: Fonts.display, fontWeight: '800', fontSize: 18, lineHeight: 22 },
  person: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingLeft: 4, paddingRight: Spacing.twoHalf, paddingVertical: 4, borderRadius: Radius.pill, backgroundColor: Palette.white, ...Shadow.card },
  personAvatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: Palette.blueMist, alignItems: 'center', justifyContent: 'center' },
  personAvatarText: { color: Palette.parisBlue, fontFamily: Fonts.display, fontWeight: '800', fontSize: 12, lineHeight: 15 },
  personName: { ...Typography.caption, color: Palette.ink, fontFamily: Fonts.sans, fontWeight: '700' },
  personCount: { ...Typography.caption, color: Palette.inkSoft, fontFamily: Fonts.sans, fontWeight: '700' },
  empty: { flex: 1, padding: Spacing.four, alignItems: 'center', justifyContent: 'center', gap: Spacing.two },
  emptyTitle: { ...Typography.title, color: Palette.ink, fontFamily: Fonts.display, fontWeight: '800' },
  emptyCopy: { ...Typography.body, color: Palette.inkSoft, fontFamily: Fonts.sans, textAlign: 'center' },
  credit: { ...Typography.caption, marginTop: Spacing.four, color: Palette.inkSoft, fontFamily: Fonts.sans, textAlign: 'center' },
  pressed: { opacity: 0.8, transform: [{ scale: 0.95 }] },
  pressedSoft: { opacity: 0.75 },
});
