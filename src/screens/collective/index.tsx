import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { SymbolView } from '@/components/ui/symbol';
import { Image } from 'expo-image';
import { useMemo, useState } from 'react';
import {
  Keyboard,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BeforeAfterSlider } from '@/components/before-after-slider';
import { ContributorAvatar } from '@/components/contributor-avatar';
import { ContributorRow } from '@/components/contributor-row';
import { ParisGoBadge } from '@/components/paris-go-badge';
import { PrimaryButton } from '@/components/primary-button';
import { StationCard } from '@/components/station-card';
import { Illustrations } from '@/constants/illustrations';
import { Fonts, HitSize, Kicker, Palette, Radius, Shadow, Spacing, TabBarClearance, Typography } from '@/constants/theme';

import { useStations } from '@/providers/stations-provider';
import {
  buildLocalSuggestion,
  formatSnapshotDate,
} from '@/services/collective-content';

import type { StationDetail } from '@/types/station';
import { formatContributorName, searchContributors } from '@/utils/community-stats';
import { mappingStatus } from '@/utils/mapping-coverage';

/** Nombre de personnes montrées directement sous le champ de recherche. */
const SEARCH_PREVIEW = 8;

function LiveComparisonCard({
  detail,
  onOpen,
}: {
  detail: StationDetail;
  onOpen: () => void;
}) {
  if (!detail.referenceImage || !detail.recaptureImage) return null;

  return (
    <View style={styles.activityCard}>
      <BeforeAfterSlider
        before={detail.referenceImage}
        after={detail.recaptureImage}
        beforeLabel={String(detail.year)}
        afterLabel="2026"
        borderRadius={0}
        onPressSide={onOpen}
      />
      <Pressable
        accessibilityLabel={`Ouvrir la photo refaite ${detail.name}`}
        accessibilityRole="button"
        onPress={onOpen}
        style={({ pressed }) => [styles.activityBody, pressed && styles.activityCardPressed]}>
        <ParisGoBadge photo={detail} />
        <Text style={styles.activityTitle}>{detail.name}</Text>
        <View style={styles.activityMetaRow}>
          <Text style={styles.activityMeta} numberOfLines={1}>
            {[
              detail.currentAuthor ? formatContributorName(detail.currentAuthor) : undefined,
              detail.recaptureDate ? formatSnapshotDate(detail.recaptureDate) : undefined,
              detail.arrondissement ?? 'Paris',
            ]
              .filter(Boolean)
              .join(' · ')}
          </Text>
          <SymbolView name="arrow.right" size={13} tintColor={Palette.parisBlue} />
        </View>
      </Pressable>
    </View>
  );
}

export function CollectiveScreen() {
  const router = useRouter();
  const {
    stations,
    snapshotVersion,
    coverage,
    stats,
    publishedSubmissions,
    findContributorSubmissions,
    refresh,
    refreshing,
  } = useStations();
  const [query, setQuery] = useState('');
  const searching = query.trim().length > 0;
  // Les reprises publiées sont dans l'instantané : plus de requêtes en cascade pour les trouver.
  const feed = publishedSubmissions;
  const feedStatus: 'loading' | 'ready' | 'error' = feed.length ? 'ready' : 'error';
  const openStations = useMemo(
    () => stations.filter((station) => mappingStatus(station) === 'to-reprise'),
    [stations],
  );
  const remainingMissions = openStations.slice(0, 6);
  const localSuggestion = useMemo(() => buildLocalSuggestion(openStations), [openStations]);
  const snapshotDate = formatSnapshotDate(snapshotVersion);
  // Malgré son nom historique, topContributors contient tous les auteurs du relevé, du plus actif
  // au moins actif.
  const matches = useMemo(
    () => (searching ? searchContributors(stats.topContributors, query) : []),
    [searching, stats.topContributors, query],
  );
  const results = useMemo(
    () =>
      matches.slice(0, SEARCH_PREVIEW).map((contributor) => ({
        ...contributor,
        displayName: formatContributorName(contributor.name),
        photos: findContributorSubmissions(contributor.name).slice(0, 4),
      })),
    [matches, findContributorSubmissions],
  );
  const percentageLabel = coverage.percentage.toLocaleString('fr-FR');

  const openContributor = (name: string) => {
    void Haptics.selectionAsync();
    Keyboard.dismiss();
    router.push({ pathname: '/contributor/[name]', params: { name } });
  };
  const openStation = (id: string) => {
    Keyboard.dismiss();
    router.push({ pathname: '/station/[id]', params: { id } });
  };

  return (
    <View style={styles.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void refresh()}
            tintColor={Palette.parisBlue}
          />
        }
        contentContainerStyle={styles.content}>
        <SafeAreaView edges={['top']} style={styles.header}>
          <View style={styles.brandRow}>
            <View style={styles.titleBlock}>
              <Text style={styles.kicker}>Paris GO</Text>
              <Text accessibilityRole="header" style={styles.brand}>Communauté</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Voir les statistiques"
              onPress={() => router.push('/coverage')}
              style={({ pressed }) => [styles.statsLink, pressed && styles.pressedSoft]}>
              <SymbolView name="chart.bar.fill" size={18} tintColor={Palette.ink} />
              <Text style={styles.statsLinkText}>Bilan</Text>
            </Pressable>
          </View>
          {/* La recherche répond dès la première lettre : on retrouve une personne par son
              prénom, et ses dernières photos avec elle. */}
          <View style={styles.search}>
            <SymbolView name="magnifyingglass" size={19} tintColor={Palette.inkSoft} />
            <TextInput
              accessibilityLabel="Chercher une personne par son prénom"
              placeholder="Chercher un prénom"
              placeholderTextColor={Palette.inkSoft}
              value={query}
              onChangeText={setQuery}
              autoCorrect={false}
              autoCapitalize="words"
              returnKeyType="search"
              onSubmitEditing={Keyboard.dismiss}
              clearButtonMode="never"
              style={styles.searchInput}
            />
            {searching ? (
              <Pressable accessibilityRole="button" accessibilityLabel="Effacer la recherche"
                onPress={() => setQuery('')} style={styles.searchClear}>
                <SymbolView name="xmark.circle.fill" size={20} tintColor={Palette.inkSoft} />
              </Pressable>
            ) : null}
          </View>
        </SafeAreaView>

        {searching ? (
          <View>
            <Text accessibilityLiveRegion="polite" style={styles.resultCount}>
              {matches.length
                ? `${matches.length} ${matches.length > 1 ? 'personnes trouvées' : 'personne trouvée'}`
                : 'Personne ne porte ce prénom dans le relevé'}
            </Text>
            {matches.length ? (
              <View style={styles.results}>
                {results.map((contributor) => (
                  <ContributorRow
                    key={contributor.name}
                    displayName={contributor.displayName}
                    count={contributor.count}
                    photos={contributor.photos}
                    onOpen={() => openContributor(contributor.name)}
                    onOpenPhoto={(photo) => openStation(photo.id)}
                  />
                ))}
              </View>
            ) : (
              <Text style={styles.resultHint}>
                Essayez une autre orthographe. Seules les personnes dont une photo est publiée
                apparaissent ici.
              </Text>
            )}
            {matches.length > SEARCH_PREVIEW ? (
              <PrimaryButton
                label={`Voir les ${matches.length} personnes`}
                variant="outline"
                onPress={() => router.push({ pathname: '/contributors', params: { q: query.trim() } })}
                style={styles.moreButton}
              />
            ) : null}
          </View>
        ) : (
          <>
            <View style={styles.sectionHeader}>
              <Text accessibilityRole="header" style={styles.sectionTitle}>Les plus actifs</Text>
              <Pressable
                accessibilityRole="link"
                accessibilityLabel={`Voir les ${stats.contributorCount} personnes`}
                onPress={() => router.push('/contributors')}
                style={({ pressed }) => [styles.sectionLink, pressed && styles.pressedSoft]}>
                <Text style={styles.sectionLinkText}>Tout le monde</Text>
                <SymbolView name="chevron.right" size={12} tintColor={Palette.go} />
              </Pressable>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.peopleRail}>
              {stats.topContributors.slice(0, 8).map((contributor) => {
                const displayName = formatContributorName(contributor.name);
                return (
                  <Pressable
                    key={contributor.name}
                    accessibilityLabel={`Voir les photos de ${displayName}, ${contributor.count} photos`}
                    accessibilityRole="button"
                    onPress={() => openContributor(contributor.name)}
                    style={({ pressed }) => [styles.person, pressed && styles.pressedSoft]}>
                    <ContributorAvatar name={displayName} size={60} />
                    <Text style={styles.personName} numberOfLines={1}>{displayName}</Text>
                    <Text style={styles.personCount}>{contributor.count.toLocaleString('fr-FR')} photos</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <View style={styles.sectionHeader}>
              <Text accessibilityRole="header" style={styles.sectionTitle}>Dernières photos refaites</Text>
            </View>
            {/* La comparaison avant/après est le sujet même de l'app : elle occupe la largeur,
                sans carte blanche autour. */}
            {feedStatus === 'ready' ? (
              <View style={styles.feed}>{feed.map((detail) => (
                <LiveComparisonCard
                  key={detail.id}
                  detail={detail}
                  onOpen={() =>
                    router.push({ pathname: '/station/[id]', params: { id: detail.id } })
                  }
                />
              ))}</View>
            ) : (
              <View style={styles.feedEmpty}>
                <SymbolView name="photo.on.rectangle.angled" size={24} tintColor={Palette.inkSoft} />
                <Text style={styles.loadingTitle}>Aucune photo refaite pour l’instant</Text>
                <Text style={styles.loadingCopy}>
                  Les comparaisons avant/après apparaîtront ici dès qu’une photo sera publiée.
                </Text>
              </View>
            )}

            {/* Le bilan collectif tient en une ligne, comme sur l'accueil. */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Bilan : ${coverage.published1970.toLocaleString('fr-FR')} photos refaites par ${stats.contributorCount.toLocaleString('fr-FR')} personnes, ${percentageLabel} % des photos de 1970. Voir le bilan`}
              onPress={() => {
                void Haptics.selectionAsync();
                router.push('/coverage');
              }}
              style={({ pressed }) => [styles.progress, pressed && styles.pressedSoft]}>
              <Image source={Illustrations.parisProgress} style={styles.progressIllustration} contentFit="contain" />
              <View style={styles.progressCopy}>
                <Text style={styles.progressLabel}>
                  <Text style={styles.progressValue}>{coverage.published1970.toLocaleString('fr-FR')}</Text> photos refaites
                  par {stats.contributorCount.toLocaleString('fr-FR')} personnes
                </Text>
                <Text style={styles.progressHint}>Voir le bilan</Text>
              </View>
              <SymbolView name="chevron.right" size={14} tintColor={Palette.inkSoft} />
            </Pressable>

            <View style={styles.sectionHeader}>
              <Text accessibilityRole="header" style={styles.sectionTitle}>Photos à retrouver</Text>
            </View>
            <ScrollView
              horizontal
              contentContainerStyle={styles.missionRail}
              decelerationRate="fast"
              showsHorizontalScrollIndicator={false}>
              {remainingMissions.map((station) => (
                <StationCard key={station.id} station={station} compact />
              ))}
            </ScrollView>

            {localSuggestion ? (
              <View style={styles.walkCard}>
                <Text style={styles.walkKicker}>SUGGESTION LOCALE · {localSuggestion.sector}</Text>
                <Text style={styles.walkTitle}>Explorer ce secteur</Text>
                <Text style={styles.walkCopy}>
                  {localSuggestion.missionCount} {localSuggestion.missionCount > 1 ? 'photos de 1970 attendent' : 'photo de 1970 attend'} encore
                  d’être refaites ici.
                </Text>
                <PrimaryButton
                  label="Voir un point de départ"
                  icon="arrow.right"
                  variant="secondary"
                  onPress={() =>
                    router.push({
                      pathname: '/station/[id]',
                      params: { id: localSuggestion.stationId },
                    })
                  }
                  style={styles.walkAction}
                />
              </View>
            ) : null}

            <Text style={styles.sourceNote}>
              Données Observatoire : relevé public du {snapshotDate}. Archives 1970 : Bibliothèques
              spécialisées de la Ville de Paris.
            </Text>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Palette.fog },
  content: { paddingBottom: TabBarClearance },
  header: { paddingHorizontal: Spacing.three, paddingTop: Spacing.two },
  brandRow: { minHeight: 62, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  titleBlock: { flex: 1 },
  kicker: { ...Kicker, color: Palette.go },
  brand: { ...Typography.display, color: Palette.ink, fontFamily: Fonts.display, fontWeight: '800' },
  statsLink: { minHeight: HitSize, paddingHorizontal: Spacing.three, borderRadius: Radius.pill, backgroundColor: Palette.white, flexDirection: 'row', alignItems: 'center', gap: Spacing.two, ...Shadow.card },
  statsLinkText: { ...Typography.body, color: Palette.ink, fontFamily: Fonts.sans, fontWeight: '700' },
  search: { minHeight: 52, marginTop: Spacing.three, paddingLeft: Spacing.three, borderRadius: Radius.medium, backgroundColor: Palette.white, flexDirection: 'row', alignItems: 'center', gap: Spacing.two, borderWidth: 1, borderColor: Palette.line },
  searchInput: { ...Typography.body, flex: 1, minHeight: 52, color: Palette.ink, fontFamily: Fonts.sans, paddingVertical: Spacing.two },
  searchClear: { width: HitSize, height: HitSize, alignItems: 'center', justifyContent: 'center' },
  resultCount: { ...Typography.caption, marginTop: Spacing.three, marginBottom: Spacing.two, marginHorizontal: Spacing.three, color: Palette.inkSoft, fontFamily: Fonts.sans, fontWeight: '600' },
  results: { gap: StyleSheet.hairlineWidth, backgroundColor: Palette.line },
  resultHint: { ...Typography.body, marginHorizontal: Spacing.three, color: Palette.inkSoft, fontFamily: Fonts.sans },
  moreButton: { marginHorizontal: Spacing.three, marginTop: Spacing.three },
  sectionHeader: { marginTop: Spacing.four, marginBottom: Spacing.twoHalf, paddingHorizontal: Spacing.three, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.two },
  sectionTitle: { ...Typography.title, flex: 1, color: Palette.ink, fontFamily: Fonts.display, fontWeight: '800' },
  sectionLink: { minHeight: HitSize, flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  sectionLinkText: { ...Typography.body, color: Palette.go, fontFamily: Fonts.sans, fontWeight: '700' },
  peopleRail: { paddingHorizontal: Spacing.three, gap: Spacing.two },
  person: { width: 96, paddingVertical: Spacing.twoHalf, paddingHorizontal: Spacing.one, borderRadius: Radius.medium, backgroundColor: Palette.white, alignItems: 'center', gap: Spacing.one },
  personName: { ...Typography.caption, marginTop: Spacing.one, color: Palette.ink, fontFamily: Fonts.sans, fontWeight: '700' },
  personCount: { ...Typography.caption, color: Palette.inkSoft, fontFamily: Fonts.sans },
  feed: { backgroundColor: Palette.blueMist },
  // Photo pleine largeur, légende attachée, puis un espace distinct avant la suivante.
  activityCard: { marginBottom: Spacing.twoHalf, borderBottomWidth: 1, borderBottomColor: Palette.line },
  activityCardPressed: { opacity: 0.92 },
  activityBody: { paddingHorizontal: Spacing.three, paddingTop: Spacing.twoHalf, paddingBottom: Spacing.four, backgroundColor: Palette.white },
  activityTitle: { ...Typography.title, color: Palette.ink, fontFamily: Fonts.display },
  activityMetaRow: { marginTop: Spacing.half, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  activityMeta: { ...Typography.body, flex: 1, color: Palette.inkSoft, fontFamily: Fonts.sans },
  feedEmpty: { marginHorizontal: Spacing.three, marginBottom: Spacing.four, alignItems: 'center' },
  loadingTitle: { ...Typography.title, marginTop: Spacing.three, color: Palette.ink, fontFamily: Fonts.display },
  loadingCopy: { ...Typography.body, marginTop: Spacing.one, color: Palette.inkSoft, fontFamily: Fonts.sans, textAlign: 'center' },
  progress: { marginHorizontal: Spacing.three, marginTop: Spacing.three, minHeight: 64, paddingVertical: Spacing.two, paddingHorizontal: Spacing.three, borderRadius: Radius.large, backgroundColor: Palette.white, flexDirection: 'row', alignItems: 'center', gap: Spacing.twoHalf, ...Shadow.card },
  progressIllustration: { width: 44, height: 44 },
  progressCopy: { flex: 1 },
  progressLabel: { ...Typography.body, color: Palette.ink, fontFamily: Fonts.sans, fontWeight: '600' },
  progressValue: { color: Palette.go, fontFamily: Fonts.display, fontWeight: '800' },
  progressHint: { ...Typography.caption, color: Palette.inkSoft, fontFamily: Fonts.sans },
  // Bord à bord : le rail de vignettes n'a pas de marge de page, seul le texte des têtes de
  // section en garde une.
  missionRail: { gap: Spacing.three, paddingBottom: Spacing.one },
  walkCard: { marginTop: Spacing.four, marginHorizontal: Spacing.three, padding: Spacing.three, borderRadius: Radius.large, backgroundColor: Palette.white, ...Shadow.card },
  walkKicker: { ...Kicker, color: Palette.go },
  walkTitle: { ...Typography.title, marginTop: Spacing.one, color: Palette.ink, fontFamily: Fonts.display, fontWeight: '800' },
  walkCopy: { ...Typography.body, marginTop: Spacing.one, color: Palette.inkSoft, fontFamily: Fonts.sans },
  walkAction: { marginTop: Spacing.three },
  sourceNote: { ...Typography.caption, margin: Spacing.three, marginTop: Spacing.four, color: Palette.inkSoft, fontFamily: Fonts.sans, textAlign: 'center' },
  pressedSoft: { opacity: 0.75 },
});
