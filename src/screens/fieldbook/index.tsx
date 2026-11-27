import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { SymbolView } from 'expo-symbols';
import { useCallback, useMemo, useState } from 'react';
import * as Haptics from 'expo-haptics';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { Illustrations } from '@/constants/illustrations';
import { BadgeShelf } from '@/components/badge-shelf';
import { NextWalkPrompt } from '@/components/next-walk-prompt';
import { PrimaryButton } from '@/components/primary-button';
import { ScreenHeader } from '@/components/ui/screen-header';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { useStations } from '@/providers/stations-provider';
import { computeBadges } from '@/services/badges';
import { AlbumCoverCard } from '@/components/album-cover-card';
import {
  Fonts,
  Kicker,
  Palette,
  Radius,
  Spacing,
  Typography,
} from '@/constants/theme';
import { useAlbumReferences } from '@/hooks/use-album-references';
import { albumTitleStore } from '@/services/album-title-store';
import type { AlbumTitles } from '@/services/album-titles';
import { albumDayKey, defaultAlbumTitle, formatWalkDistance, groupCapturesIntoAlbums, suggestNextPhoto, walkDistanceMeters } from '@/services/albums';
import { deleteCapture, getSavedCaptures, type SavedCapture } from '@/services/fieldbook';
import { getFieldbookViewState } from '@/services/fieldbook-view-state';

const dateFormat = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

function formatDate(value: string) {
  return dateFormat.format(new Date(value));
}

export function FieldbookScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [captures, setCaptures] = useState<SavedCapture[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [albumTitles, setAlbumTitles] = useState<AlbumTitles>({});
  // Les balades d'abord : c'est la façon la plus parlante de relire son carnet.
  const [view, setView] = useState<'albums' | 'photos'>('albums');

  const load = useCallback(async () => {
    setError(undefined);
    try {
      setCaptures(await getSavedCaptures());
      setAlbumTitles(await albumTitleStore.list().catch(() => ({})));
    } catch {
      setError('Le carnet n’a pas pu être ouvert. Réessayez.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const compare = (capture: SavedCapture) => {
    router.push({
      pathname: '/capture-review',
      params: {
        captureId: capture.id,
        id: capture.stationId,
        frame: String(capture.frameIndex),
        uri: capture.imageUri ?? '',
        simulated: capture.simulated ? '1' : '0',
        roll: capture.roll === undefined ? '' : String(capture.roll),
        pitch: capture.pitch === undefined ? '' : String(capture.pitch),
        resumed: '1',
        currentSaved: capture.preparation.current.ready ? '1' : '0',
        currentPreparation: JSON.stringify(capture.preparation.current),
        referencePreparation: JSON.stringify(capture.preparation.reference),
        latitude: capture.coordinate ? String(capture.coordinate.latitude) : '',
        longitude: capture.coordinate ? String(capture.coordinate.longitude) : '',
        locationPrecision: capture.locationPrecision ?? '',
      },
    });
  };

  const resumeSubmission = (capture: SavedCapture) => {
    router.push({
      pathname: '/official-submit' as never,
      params: {
        captureId: capture.id,
        id: capture.stationId,
        frame: String(capture.frameIndex),
        uri: capture.imageUri ?? '',
        simulated: capture.simulated ? '1' : '0',
        currentSaved: capture.preparation.current.ready ? '1' : '0',
        currentPreparation: JSON.stringify(capture.preparation.current),
        referencePreparation: JSON.stringify(capture.preparation.reference),
        latitude: capture.coordinate ? String(capture.coordinate.latitude) : '',
        longitude: capture.coordinate ? String(capture.coordinate.longitude) : '',
      },
    });
  };

  const share = async (capture: SavedCapture) => {
    if (capture.imageUri && (await Sharing.isAvailableAsync())) {
      await Sharing.shareAsync(capture.imageUri, {
        dialogTitle: 'Partager cette reprise',
        mimeType: 'image/jpeg',
        UTI: 'public.jpeg',
      });
      return;
    }
    await Share.share({
      message: `Ma photo de ${capture.stationName ?? 'Paris'}, 1970 et aujourd’hui, avec Paris GO.`,
    });
  };

  const confirmDelete = (capture: SavedCapture) => {
    Alert.alert(
      'Supprimer cette photo ?',
      'La copie privée dans Paris GO sera supprimée. La copie éventuellement enregistrée dans Photos restera intacte.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => {
            void deleteCapture(capture.id)
              .then(() => setCaptures((current) => current.filter((item) => item.id !== capture.id)))
              .catch(() =>
                Alert.alert('Suppression impossible', 'La photo n’a pas été supprimée.'),
              );
          },
        },
      ],
    );
  };

  const state = getFieldbookViewState(captures);
  const { findStation, stations } = useStations();
  const badges = useMemo(
    () => computeBadges(captures, (stationId) => findStation(stationId)?.frameCount),
    [captures, findStation],
  );
  const albums = useMemo(() => groupCapturesIntoAlbums(captures), [captures]);
  const showAlbums = view === 'albums';
  // Une seule photo aujourd'hui : la balade du jour attend sa deuxième photo, la plus proche possible.
  const realCaptures = useMemo(
    () => captures.filter((capture) => !capture.simulated && capture.imageUri)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [captures],
  );
  const todayKey = albumDayKey(new Date().toISOString());
  const todayCaptures = realCaptures.filter((capture) => albumDayKey(capture.createdAt) === todayKey);
  const todayCapture = todayCaptures.length === 1 ? todayCaptures[0] : undefined;
  const nextFrom = (todayCapture ?? realCaptures.find((capture) => capture.coordinate))?.coordinate;
  const nextPhoto = useMemo(() => suggestNextPhoto(stations, nextFrom), [stations, nextFrom]);
  const showNextWalk = Boolean(todayCapture) || albums.length === 0;
  const totalDistance = formatWalkDistance(
    albums.reduce((sum, album) => sum + walkDistanceMeters(album.captures.map((capture) => capture.coordinate)), 0),
  );
  const references = useAlbumReferences(captures);
  const tileWidth = (width - Spacing.three * 2 - Spacing.twoHalf) / 2;

  const openMenu = (capture: SavedCapture) => {
    void Haptics.selectionAsync();
    const actions = [
      { label: 'Comparer avec la photo d’archive', run: () => compare(capture) },
      { label: 'Contribuer à l’Observatoire', run: () => resumeSubmission(capture) },
      { label: 'Partager', run: () => void share(capture) },
      { label: 'Supprimer', run: () => confirmDelete(capture), destructive: true },
    ];
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: references.get(capture.id)?.label ?? capture.stationName,
          options: [...actions.map((action) => action.label), 'Annuler'],
          destructiveButtonIndex: 3,
          cancelButtonIndex: actions.length,
        },
        (index) => actions[index]?.run(),
      );
      return;
    }
    Alert.alert(references.get(capture.id)?.label ?? 'Reprise', undefined, [
      ...actions.map((action) => ({
        text: action.label,
        style: action.destructive ? ('destructive' as const) : ('default' as const),
        onPress: action.run,
      })),
      { text: 'Annuler', style: 'cancel' as const },
    ]);
  };

  const summary = [
    albums.length ? `${albums.length} ${albums.length > 1 ? 'balades' : 'balade'}` : undefined,
    `${state.kind === 'filled' ? state.count : 0} ${state.kind === 'filled' && state.count > 1 ? 'photos' : 'photo'}`,
    totalDistance,
  ].filter(Boolean).join(' · ');

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Carnet" variant="sheet" onClose={() => router.back()} />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Palette.parisBlue} />
          <Text style={styles.status}>Ouverture du carnet…</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <SymbolView name="exclamationmark.triangle.fill" size={30} tintColor={Palette.copper} />
          <Text style={styles.emptyTitle}>Carnet indisponible</Text>
          <Text style={styles.emptyCopy}>{error}</Text>
          <PrimaryButton label="Réessayer" onPress={() => void load()} style={styles.emptyAction} />
        </View>
      ) : state.kind === 'empty' ? (
        // Défile dès que le texte est agrandi : rien ne doit passer sous l'en-tête ou hors de l'écran.
        <ScrollView contentContainerStyle={styles.emptyScroll}>
          <Image source={Illustrations.emptyFieldbook} style={styles.emptyIllustration} contentFit="contain" />
          <Text style={styles.emptyTitle}>{state.title}</Text>
          <Text style={styles.emptyCopy}>{state.description}</Text>
          <PrimaryButton label="Choisir une photo de 1970" onPress={() => router.replace('/map')} style={styles.emptyAction} />
        </ScrollView>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
          <Text style={styles.summary}>{summary}</Text>

          {state.count > 0 ? (
            <View style={styles.segment}>
              <SegmentedControl
                value={view}
                onChange={setView}
                options={[
                  { value: 'albums', label: `Balades · ${albums.length}` },
                  { value: 'photos', label: `Photos · ${state.count}` },
                ]}
              />
            </View>
          ) : null}

          {showAlbums ? (
            <View style={styles.albums}>
              {showNextWalk ? (
                <NextWalkPrompt
                  todayCapture={todayCapture}
                  suggestion={nextPhoto}
                  onOpenSuggestion={() => {
                    if (!nextPhoto) return;
                    router.push({ pathname: '/station/[id]', params: { id: nextPhoto.station.id } });
                  }}
                  onFindOnMap={() => router.replace('/map')}
                />
              ) : null}
              {albums.map((album) => (
                <AlbumCoverCard
                  key={album.id}
                  album={album}
                  title={albumTitles[album.id] ?? defaultAlbumTitle(album)}
                  onPress={() => router.push({ pathname: '/album/[id]', params: { id: album.id } })}
                />
              ))}
            </View>
          ) : (
            <View style={styles.grid}>
              {state.captures.map((capture) => {
                const reference = references.get(capture.id);
                return (
                  <Pressable
                    key={capture.id}
                    accessibilityHint="Ouvre les actions de cette photo"
                    accessibilityLabel={`${reference?.label ?? capture.stationName ?? 'Photo'}, ${formatDate(capture.createdAt)}`}
                    accessibilityRole="button"
                    onPress={() => openMenu(capture)}
                    style={({ pressed }) => [styles.tile, { width: tileWidth }, pressed && styles.tilePressed]}>
                    <View style={[styles.tilePhoto, { height: tileWidth * 1.15 }]}>
                      {capture.imageUri ? (
                        <Image source={{ uri: capture.imageUri }} contentFit="cover" style={StyleSheet.absoluteFill} transition={200} />
                      ) : (
                        <View style={[StyleSheet.absoluteFill, styles.simulatedThumbnail]}>
                          <SymbolView name="iphone.gen3" size={24} tintColor={Palette.parisBlue} />
                          <Text style={styles.simulatedLabel}>DÉMO</Text>
                        </View>
                      )}
                      {reference?.image ? (
                        <View style={styles.tileInset}>
                          <Image source={reference.image} contentFit="cover" style={StyleSheet.absoluteFill} />
                        </View>
                      ) : null}
                    </View>
                    <Text style={styles.tileTitle} numberOfLines={2}>{reference?.label ?? capture.stationName ?? `Point ${capture.stationId}`}</Text>
                    <Text style={styles.tileMeta} numberOfLines={1}>{formatDate(capture.createdAt)}</Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          {/* Les récompenses viennent après les souvenirs, jamais avant. */}
          <BadgeShelf badges={badges} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Palette.fog },
  center: { flex: 1, padding: Spacing.four, alignItems: 'center', justifyContent: 'center' },
  emptyScroll: { flexGrow: 1, padding: Spacing.four, alignItems: 'center', justifyContent: 'center' },
  status: { ...Typography.caption, marginTop: Spacing.two, color: Palette.inkSoft, fontFamily: Fonts.sans },
  emptyIllustration: { width: 160, height: 160 },
  emptyTitle: { ...Typography.title, marginTop: Spacing.three, color: Palette.ink, fontFamily: Fonts.display, fontWeight: '800', textAlign: 'center' },
  emptyCopy: { ...Typography.body, marginTop: Spacing.two, maxWidth: 320, textAlign: 'center', color: Palette.inkSoft, fontFamily: Fonts.sans },
  emptyAction: { marginTop: Spacing.four, alignSelf: 'stretch' },
  list: { paddingHorizontal: Spacing.three, paddingTop: Spacing.one, paddingBottom: Spacing.six, gap: Spacing.three },
  summary: { ...Typography.body, color: Palette.inkSoft, fontFamily: Fonts.sans, fontWeight: '600' },
  segment: {},
  albums: { gap: Spacing.three },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.twoHalf },
  tile: { marginBottom: Spacing.two },
  tilePressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
  tilePhoto: { borderRadius: Radius.medium, overflow: 'hidden', backgroundColor: Palette.blueMist },
  tileInset: { position: 'absolute', left: Spacing.two, bottom: Spacing.two, width: 52, height: 40, borderRadius: Radius.small, overflow: 'hidden', borderWidth: 2, borderColor: Palette.white, backgroundColor: Palette.archive },
  tileTitle: { ...Typography.caption, marginTop: Spacing.two, color: Palette.ink, fontFamily: Fonts.sans, fontWeight: '700' },
  tileMeta: { ...Typography.caption, color: Palette.inkSoft, fontFamily: Fonts.sans },
  simulatedThumbnail: { alignItems: 'center', justifyContent: 'center', gap: Spacing.one },
  simulatedLabel: { ...Kicker, color: Palette.parisBlue },
});
