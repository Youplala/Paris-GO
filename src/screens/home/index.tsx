import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { SymbolView } from '@/components/ui/symbol';
import { useMemo } from 'react';
import {
  Alert,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Illustrations } from '@/constants/illustrations';
import { IconButton } from '@/components/ui/icon-button';
import { AlbumCoverCard } from '@/components/album-cover-card';
import { MissionCard } from '@/components/mission-card';
import { SourcePill } from '@/components/source-pill';
import { StationCard } from '@/components/station-card';
import { PRIVACY_POLICY_URL } from '@/constants/legal';
import {
  Fonts,
  HitSize,
  Kicker,
  Palette,
  Radius,
  Shadow,
  Spacing,
  TabBarClearance,
  Typography,
} from '@/constants/theme';

import { useAlbums } from '@/hooks/use-albums';
import { useUserLocation } from '@/hooks/use-user-location';
import { useStations } from '@/providers/stations-provider';

import { distanceInMeters, formatDistance } from '@/utils/distance';
import { nearestArrondissement } from '@/utils/place-name';
import { PARIS_CENTER } from '@/data/archive';
import { HOME_LOCATION_CONTENT, classifyLocationContext } from '@/services/location-context';

export function HomeScreen() {
  const router = useRouter();
  const { stations, snapshotVersion, coverage, stats, refresh, refreshing, syncError } =
    useStations();
  const { coordinate, isPrecise, loading: locating, locate } = useUserLocation({
    autoLocate: true,
  });
  const locationContext = classifyLocationContext({ coordinate, isPrecise });
  const locationContent = HOME_LOCATION_CONTENT[locationContext];
  const proximityOrigin = locationContext === 'in-paris' ? coordinate : PARIS_CENTER;


  // La campagne porte sur les archives de 1970, classées par proximité.
  const nearby = useMemo(
    () =>
      stations
        .filter(
          (station) =>
            station.kind === 'archive-1970' &&
            (station.remainingCount ?? station.frameCount ?? 0) > 0,
        )
        .map((station) => ({
          station,
          distance: distanceInMeters(proximityOrigin, station.coordinate),
        }))
        .sort((left, right) => left.distance - right.distance)
        .slice(0, 5)
        // « Secteur 794 » ne situe rien : on emprunte l'arrondissement du repère localisé le plus
        // proche, comme la carte, pour que les deux écrans nomment un lieu de la même façon.
        .map(({ station, distance }) => ({
          station: {
            ...station,
            arrondissement:
              station.arrondissement ?? nearestArrondissement(station.coordinate, stations),
          },
          distance,
        })),
    [proximityOrigin, stations],
  );

  const [mission, ...others] = nearby;
  const { albums, titleFor } = useAlbums();
  const { width } = useWindowDimensions();
  const albumCardWidth = albums.length > 1 ? Math.min(300, width - 80) : width - Spacing.three * 2;
  const lastMonth = stats.monthlyActivity[stats.monthlyActivity.length - 1];
  const percentageLabel = coverage.percentage.toLocaleString('fr-FR', {
    maximumFractionDigits: 1,
  });

  const handleLocate = async () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const nextCoordinate = await locate();
    if (nextCoordinate) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return;
    }
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    // Autorisée mais introuvable (intérieur, GPS lent) : réclamer l'autorisation induisait en erreur.
    const permission = await Location.getForegroundPermissionsAsync().catch(() => undefined);
    Alert.alert(
      'Position non disponible',
      permission?.granted
        ? 'Votre téléphone n’a pas encore trouvé votre position. Réessayez dans un instant, de préférence à l’extérieur.'
        : 'Autorisez la localisation pour voir les photos de 1970 prises autour de vous.',
    );
  };

  const handleRefresh = refresh;

  return (
    <View style={styles.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={Palette.parisBlue}
          />
        }
        contentContainerStyle={styles.scrollContent}>
        <SafeAreaView edges={['top']} style={styles.safeHeader}>
          <View style={styles.brandRow}>
            <View style={styles.titleBlock}>
              <Text style={styles.kicker}>Paris GO</Text>
              {locationContext === 'in-paris' ? (
                <Text accessibilityRole="header" style={styles.brand}>Autour de moi</Text>
              ) : (
                <Text accessibilityRole="header" style={styles.brand}>Explorer Paris</Text>
              )}
            </View>
            <View style={styles.headerActions}>
              <Pressable
                accessibilityLabel="Ouvrir le carnet"
                accessibilityRole="button"
                onPress={() => router.push('/fieldbook')}
                style={({ pressed }) => [styles.carnetButton, pressed && styles.pressed]}>
                <SymbolView name="book.closed.fill" size={18} tintColor={Palette.ink} />
                <Text style={styles.carnetText}>Carnet</Text>
              </Pressable>
              <IconButton
                icon={isPrecise ? 'location.fill' : 'location'}
                accessibilityLabel={locating ? 'Recherche de votre position' : 'Utiliser ma position'}
                onPress={() => {
                  if (!locating) void handleLocate();
                }}
              />
            </View>
          </View>

          {/* Loin de Paris, les distances ne veulent plus rien dire : on le dit, puis on propose
              le centre de Paris comme point de départ plutôt qu'une liste vide. */}
          {locationContext === 'outside-paris' && coordinate ? (
            <View style={styles.outsideNotice}>
              <SymbolView name="location.slash.fill" size={16} tintColor={Palette.go} />
              <Text style={styles.outsideNoticeText}>
                Vous êtes à {formatDistance(distanceInMeters(coordinate, PARIS_CENTER))} de Paris.
                Voici par où commencer au centre.
              </Text>
            </View>
          ) : null}

        </SafeAreaView>

        {mission ? (
          <Animated.View entering={FadeInDown.delay(60).duration(420)}>
            <MissionCard
              station={mission.station}
              distance={locationContent.showDistances ? mission.distance : undefined}
            />
          </Animated.View>
        ) : null}


        {/* Le bilan collectif tient en une ligne : il ne passe jamais devant la mission. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Bilan collectif : Paris refait à ${percentageLabel} %, ${coverage.published1970.toLocaleString('fr-FR')} photos refaites par ${stats.contributorCount.toLocaleString('fr-FR')} explorateurs. Voir le bilan`}
          onPress={() => {
            void Haptics.selectionAsync();
            router.push('/coverage');
          }}
          style={({ pressed }) => [styles.progress, pressed && styles.pressedSoft]}>
          <Image source={Illustrations.parisProgress} style={styles.progressIllustration} contentFit="contain" />
          <View style={styles.progressCopy}>
            <Text style={styles.progressLabel}>
              Paris refait à <Text style={styles.progressValue}>{percentageLabel} %</Text>
            </Text>
            <Text style={styles.progressHint}>Voir le bilan</Text>
          </View>
          <SymbolView name="chevron.right" size={14} tintColor={Palette.inkSoft} />
        </Pressable>

        {albums.length ? (
          <View style={styles.section}>
            <View style={styles.sectionHead}>
              <Text accessibilityRole="header" style={styles.sectionTitle}>Vos balades</Text>
              <Pressable
                accessibilityRole="link"
                onPress={() => router.push('/fieldbook')}
                style={({ pressed }) => [styles.sectionLink, pressed && styles.pressedSoft]}>
                <Text style={styles.sectionLinkText}>Carnet</Text>
                <SymbolView name="chevron.right" size={12} tintColor={Palette.go} />
              </Pressable>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              decelerationRate="fast"
              snapToInterval={albumCardWidth + Spacing.twoHalf}
              contentContainerStyle={styles.albumRail}>
              {albums.slice(0, 6).map((album) => (
                <AlbumCoverCard
                  key={album.id}
                  album={album}
                  title={titleFor(album)}
                  variant="compact"
                  width={albumCardWidth}
                  onPress={() => {
                    void Haptics.selectionAsync();
                    router.push({ pathname: '/album/[id]', params: { id: album.id } });
                  }}
                />
              ))}
            </ScrollView>
          </View>
        ) : null}

        {others.length ? (
          <View style={styles.section}>
            <View style={styles.sectionHead}>
              <Text accessibilityRole="header" style={styles.sectionTitle}>
                {locationContext === 'in-paris' ? 'Autres secteurs proches' : 'Autres secteurs à explorer'}
              </Text>
              <Pressable
                accessibilityRole="link"
                onPress={() => router.push('/map')}
                style={({ pressed }) => [styles.sectionLink, pressed && styles.pressedSoft]}>
                <Text style={styles.sectionLinkText}>Carte</Text>
                <SymbolView name="chevron.right" size={12} tintColor={Palette.go} />
              </Pressable>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.rail}>
              {others.map(({ station, distance }) => (
                <StationCard
                  key={station.id}
                  station={station}
                  distance={locationContent.showDistances ? distance : undefined}
                />
              ))}
            </ScrollView>
            <Text style={styles.activity}>
              {stats.recapturesLast30Days > 0
                ? `${stats.recapturesLast30Days} photos publiées ces 30 derniers jours`
                : `${lastMonth?.count ?? 0} photos publiées en ${lastMonth?.label ?? ''}`}
            </Text>
          </View>
        ) : null}

        <View style={styles.dataNote}>
          <SourcePill version={snapshotVersion} />
          <Text style={styles.dataCopy}>
            Photos de 1970 conservées par la Bibliothèque historique de la Ville de Paris. Carte et
            photos actuelles publiées par l’Observatoire photo participatif des paysages parisiens, animé
            par le CAUE de Paris.
          </Text>
          {syncError ? (
            <View style={styles.offline}>
              <SymbolView name="icloud.slash" size={22} tintColor={Palette.inkSoft} />
              <Text accessibilityLiveRegion="polite" style={styles.offlineText}>
                Mise à jour indisponible. Les données déjà chargées restent accessibles.
              </Text>
            </View>
          ) : null}
          <Pressable
            accessibilityRole="link"
            onPress={() => void Linking.openURL(PRIVACY_POLICY_URL)}
            style={({ pressed }) => [styles.privacyLink, pressed && styles.pressedSoft]}>
            <Text style={styles.privacyLinkText}>Politique de confidentialité</Text>
            <SymbolView name="arrow.up.right" size={12} tintColor={Palette.parisBlue} />
          </Pressable>
        </View>
      </ScrollView>

      {locating ? (
        <Animated.View entering={FadeInDown.duration(200)} style={styles.locatingToast}>
          <Text style={styles.locatingText}>Recherche de votre position…</Text>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  carnetButton: { minHeight: HitSize, paddingHorizontal: Spacing.three, borderRadius: Radius.pill, backgroundColor: Palette.white, flexDirection: 'row', alignItems: 'center', gap: Spacing.two, ...Shadow.card },
  carnetText: { ...Typography.body, color: Palette.ink, fontFamily: Fonts.sans, fontWeight: '700' },
  progress: { marginHorizontal: Spacing.three, marginTop: Spacing.three, minHeight: 64, paddingVertical: Spacing.two, paddingHorizontal: Spacing.three, borderRadius: Radius.large, backgroundColor: Palette.white, flexDirection: 'row', alignItems: 'center', gap: Spacing.twoHalf, ...Shadow.card },
  progressIllustration: { width: 44, height: 44 },
  progressCopy: { flex: 1 },
  progressLabel: { ...Typography.body, color: Palette.ink, fontFamily: Fonts.sans, fontWeight: '600' },
  progressValue: { color: Palette.go, fontFamily: Fonts.display, fontWeight: '800' },
  progressHint: { ...Typography.caption, color: Palette.inkSoft, fontFamily: Fonts.sans },
  offline: { flexDirection: 'row', alignItems: 'center', gap: Spacing.twoHalf, paddingVertical: Spacing.two },
  offlineText: { ...Typography.body, flex: 1, color: Palette.ink, fontFamily: Fonts.sans },
  screen: {
    flex: 1,
    backgroundColor: Palette.fog,
  },
  scrollContent: {
    paddingBottom: TabBarClearance,
  },
  safeHeader: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.four,
  },
  brandRow: {
    minHeight: 62,
    paddingTop: Spacing.two,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
  },
  titleBlock: {
    flex: 1,
    gap: Spacing.half,
  },
  kicker: {
    ...Kicker,
    color: Palette.go,
  },
  brand: {
    ...Typography.display,
    color: Palette.ink,
    fontFamily: Fonts.display,
    fontWeight: '800',
  },
  headerActions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  pressed: {
    transform: [{ scale: 0.94 }],
  },
  pressedSoft: {
    opacity: 0.6,
  },
  outsideNotice: {
    marginTop: Spacing.twoHalf,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.twoHalf,
    borderRadius: Radius.medium,
    backgroundColor: Palette.goSoft,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  outsideNoticeText: {
    ...Typography.caption,
    flex: 1,
    color: Palette.ink,
    fontFamily: Fonts.sans,
    fontWeight: '600',
  },
  albumRail: {
    paddingHorizontal: Spacing.three,
    gap: Spacing.twoHalf,
  },
  section: {
    marginTop: Spacing.five,
    gap: Spacing.twoHalf,
  },
  sectionHead: {
    paddingHorizontal: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    ...Typography.title,
    color: Palette.ink,
    fontFamily: Fonts.display,
    fontWeight: '800',
  },
  sectionLink: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  sectionLinkText: {
    ...Typography.body,
    color: Palette.go,
    fontFamily: Fonts.sans,
    fontWeight: '700',
  },
  rail: {
    paddingHorizontal: Spacing.three,
    gap: Spacing.twoHalf,
  },
  activity: {
    ...Typography.caption,
    paddingHorizontal: Spacing.three,
    color: Palette.inkSoft,
    fontFamily: Fonts.sans,
  },
  dataNote: {
    margin: Spacing.three,
    marginTop: Spacing.four,
    gap: Spacing.two,
  },
  dataCopy: {
    ...Typography.caption,
    color: Palette.inkSoft,
    fontFamily: Fonts.sans,
  },
  privacyLink: {
    minHeight: 44,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  privacyLinkText: {
    ...Typography.caption,
    color: Palette.parisBlue,
    fontFamily: Fonts.sans,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  locatingToast: {
    position: 'absolute',
    left: Spacing.three,
    right: Spacing.three,
    bottom: 104,
    minHeight: 48,
    borderRadius: Radius.pill,
    backgroundColor: Palette.blueDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locatingText: {
    ...Typography.body,
    color: Palette.white,
    fontFamily: Fonts.sans,
    fontWeight: '700',
  },
});
