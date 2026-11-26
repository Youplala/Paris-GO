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
import { SafeAreaView } from 'react-native-safe-area-context';

import { Illustrations } from '@/constants/illustrations';
import { AlbumCoverCard } from '@/components/album-cover-card';
import {
  Fonts,
  HitSize,
  Kicker,
  Palette,
  Radius,
  Shadow,
  Spacing,
  Stat,
  Typography,
} from '@/constants/theme';
import { useAlbumReferences } from '@/hooks/use-album-references';
import { albumTitleStore } from '@/services/album-title-store';
import type { AlbumTitles } from '@/services/album-titles';
import { defaultAlbumTitle, formatWalkDistance, groupCapturesIntoAlbums, walkDistanceMeters } from '@/services/albums';
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
      message: `Ma reprise de ${capture.stationName ?? 'Paris'} avec Paris GO.`,
    });
  };

  const confirmDelete = (capture: SavedCapture) => {
    Alert.alert(
      'Supprimer ce brouillon ?',
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
                Alert.alert('Suppression impossible', 'Le brouillon n’a pas été supprimé.'),
              );
          },
        },
      ],
    );
  };

  const state = getFieldbookViewState(captures);
  const albums = useMemo(() => groupCapturesIntoAlbums(captures), [captures]);
  const showAlbums = view === 'albums' && albums.length > 0;
  const totalDistance = formatWalkDistance(
    albums.reduce((sum, album) => sum + walkDistanceMeters(album.captures.map((capture) => capture.coordinate)), 0),
  );
  const references = useAlbumReferences(captures);
  const tileWidth = (width - Spacing.three * 2 - Spacing.twoHalf) / 2;

  const openMenu = (capture: SavedCapture) => {
    void Haptics.selectionAsync();
    const actions = [
      { label: 'Comparer avec la photo d’archive', run: () => compare(capture) },
      { label: 'Reprendre le dépôt', run: () => resumeSubmission(capture) },
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

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={['top']} style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.kicker}>VOS REPRISES</Text>
          <Text accessibilityRole="header" style={styles.title}>Carnet</Text>
        </View>
        <Pressable
          accessibilityLabel="Fermer le carnet"
          onPress={() => router.back()}
          style={({ pressed }) => [styles.close, pressed && styles.pressed]}>
          <SymbolView name="xmark" size={16} weight="semibold" tintColor={Palette.ink} />
        </Pressable>
      </SafeAreaView>

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
          <Pressable onPress={() => void load()} style={styles.retry}>
            <Text style={styles.retryText}>Réessayer</Text>
          </Pressable>
        </View>
      ) : state.kind === 'empty' ? (
        <View style={styles.center}>
          <Image source={Illustrations.emptyFieldbook} style={styles.emptyIllustration} contentFit="contain" />
          <Text style={styles.emptyTitle}>{state.title}</Text>
          <Text style={styles.emptyCopy}>{state.description}</Text>
          <Pressable onPress={() => router.replace('/map')} style={styles.retry}>
            <Text style={styles.retryText}>Choisir une photo de 1970</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
          <View style={styles.summary}>
            {[
              { value: String(albums.length), label: albums.length > 1 ? 'balades' : 'balade' },
              { value: String(state.count), label: state.count > 1 ? 'reprises' : 'reprise' },
              ...(totalDistance ? [{ value: totalDistance, label: 'à pied' }] : []),
            ].map((item) => (
              <View key={item.label} style={styles.summaryItem}>
                <Text style={styles.summaryValue} adjustsFontSizeToFit numberOfLines={1}>{item.value}</Text>
                <Text style={styles.summaryLabel}>{item.label}</Text>
              </View>
            ))}
          </View>

          {albums.length > 0 ? (
            <View accessibilityRole="tablist" style={styles.segment}>
              {([
                ['albums', `Balades · ${albums.length}`],
                ['photos', `Photos · ${state.count}`],
              ] as const).map(([key, label]) => {
                const active = view === key;
                return (
                  <Pressable
                    key={key}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: active }}
                    onPress={() => {
                      void Haptics.selectionAsync();
                      setView(key);
                    }}
                    style={[styles.segmentItem, active && styles.segmentItemActive]}>
                    <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          {showAlbums ? (
            <View style={styles.albums}>
              {albums.map((album) => (
                <AlbumCoverCard
                  key={album.id}
                  album={album}
                  title={albumTitles[album.id] ?? defaultAlbumTitle(album)}
                  onPress={() => router.push({ pathname: '/album/[id]', params: { id: album.id } })}
                />
              ))}
              <Text style={styles.footnote}>
                Une balade par jour de reprises. Tout reste sur cet appareil jusqu’à ce que vous le partagiez.
              </Text>
            </View>
          ) : (
            <View style={styles.grid}>
              {state.captures.map((capture) => {
                const reference = references.get(capture.id);
                const ready = capture.preparation.current.ready;
                return (
                  <Pressable
                    key={capture.id}
                    accessibilityHint="Ouvre les actions de cette reprise"
                    accessibilityLabel={`${reference?.label ?? capture.stationName ?? 'Reprise'}, ${formatDate(capture.createdAt)}, dépôt ${ready ? 'prêt' : 'à préparer'}`}
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
                      <View style={[styles.tileStatus, ready ? styles.tileStatusReady : styles.tileStatusTodo]}>
                        <SymbolView name={ready ? 'checkmark' : 'arrow.up'} size={10} weight="bold" tintColor={Palette.white} />
                        <Text style={styles.tileStatusText}>{ready ? 'Prête' : 'À déposer'}</Text>
                      </View>
                    </View>
                    <Text style={styles.tileTitle} numberOfLines={1}>{reference?.label ?? capture.stationName ?? `Point ${capture.stationId}`}</Text>
                    <Text style={styles.tileMeta} numberOfLines={1}>{formatDate(capture.createdAt)}</Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Palette.fog },
  header: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  headerCopy: { flex: 1 },
  kicker: { ...Kicker, color: Palette.go },
  title: { ...Typography.display, fontSize: 36, lineHeight: 40, color: Palette.ink, fontFamily: Fonts.display, fontWeight: '800' },
  close: {
    width: HitSize,
    height: HitSize,
    marginBottom: 2,
    borderRadius: HitSize / 2,
    backgroundColor: Palette.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.card,
  },
  center: { flex: 1, padding: Spacing.four, alignItems: 'center', justifyContent: 'center' },
  status: { ...Typography.caption, marginTop: Spacing.two, color: Palette.inkSoft, fontFamily: Fonts.sans },
  emptyIllustration: { width: 200, height: 200 },
  emptyTitle: { ...Typography.display, marginTop: Spacing.three, color: Palette.ink, fontFamily: Fonts.display, fontWeight: '800' },
  emptyCopy: { ...Typography.body, marginTop: Spacing.two, maxWidth: 300, textAlign: 'center', color: Palette.inkSoft, fontFamily: Fonts.sans },
  retry: { marginTop: Spacing.four, minHeight: 52, paddingHorizontal: Spacing.four, borderRadius: Radius.pill, backgroundColor: Palette.go, alignItems: 'center', justifyContent: 'center' },
  retryText: { ...Typography.body, color: Palette.white, fontFamily: Fonts.sans, fontWeight: '700' },
  list: { paddingHorizontal: Spacing.three, paddingTop: Spacing.two, paddingBottom: Spacing.six },
  summary: { flexDirection: 'row', gap: Spacing.two },
  summaryItem: { flex: 1, paddingVertical: Spacing.twoHalf, paddingHorizontal: Spacing.twoHalf, borderRadius: Radius.medium, backgroundColor: Palette.white, ...Shadow.card },
  summaryValue: { ...Stat, fontSize: 26, lineHeight: 30, color: Palette.parisBlue },
  summaryLabel: { ...Typography.caption, color: Palette.inkSoft, fontFamily: Fonts.sans, fontWeight: '600' },
  segment: { flexDirection: 'row', padding: 3, marginTop: Spacing.three, marginBottom: Spacing.three, borderRadius: Radius.pill, backgroundColor: Palette.blueMist },
  segmentItem: { flex: 1, minHeight: 38, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
  segmentItemActive: { backgroundColor: Palette.ink },
  segmentText: { ...Typography.caption, color: Palette.inkSoft, fontFamily: Fonts.sans, fontWeight: '700' },
  segmentTextActive: { color: Palette.white },
  albums: { gap: Spacing.three },
  footnote: { ...Typography.caption, textAlign: 'center', color: Palette.inkSoft, fontFamily: Fonts.sans, paddingHorizontal: Spacing.three },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.twoHalf },
  tile: { marginBottom: Spacing.two },
  tilePressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
  tilePhoto: { borderRadius: Radius.medium + 4, overflow: 'hidden', backgroundColor: Palette.blueMist },
  tileInset: { position: 'absolute', left: Spacing.two, bottom: Spacing.two, width: 52, height: 40, borderRadius: 10, overflow: 'hidden', borderWidth: 2, borderColor: Palette.white, backgroundColor: Palette.archive },
  tileStatus: { position: 'absolute', top: Spacing.two, right: Spacing.two, flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 3, borderRadius: Radius.pill },
  tileStatusReady: { backgroundColor: Palette.lichen },
  tileStatusTodo: { backgroundColor: 'rgba(8, 17, 22, 0.72)' },
  tileStatusText: { color: Palette.white, fontFamily: Fonts.sans, fontWeight: '700', fontSize: 11, lineHeight: 14 },
  tileTitle: { ...Typography.caption, marginTop: Spacing.two, color: Palette.ink, fontFamily: Fonts.sans, fontWeight: '700' },
  tileMeta: { ...Typography.caption, color: Palette.inkSoft, fontFamily: Fonts.sans },
  simulatedThumbnail: { alignItems: 'center', justifyContent: 'center', gap: Spacing.one },
  simulatedLabel: { ...Kicker, color: Palette.parisBlue },
  pressed: { opacity: 0.8, transform: [{ scale: 0.95 }] },
});
