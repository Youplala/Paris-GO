import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import MapView from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { captureRef } from 'react-native-view-shot';

import {
  AlbumCoverSlide,
  AlbumPairSlide,
  ALBUM_SLIDE_SIZE,
  type AlbumSlideFormat,
  type AlbumSlideMap,
  type AlbumSlidePair,
} from '@/components/album-slides';
import { Fonts, Palette, Radius, Spacing, Typography } from '@/constants/theme';
import { useAlbum } from '@/hooks/use-album';
import { groupRouteStops, squareRegionFor, type RouteStep } from '@/services/album-route';
import { saveImagesToLibrary } from '@/services/fieldbook';

const FORMATS: { key: AlbumSlideFormat; label: string }[] = [
  { key: 'post', label: 'Carrousel 4:5' },
  { key: 'story', label: 'Story 9:16' },
];

/** Au-delà, une image manquante ne bloque plus l'export : la page montre son repli. */
const IMAGE_WAIT_MS = 8000;
/** L'image satellite peut être lente à produire ; on l'attend plus longtemps que les photos. */
const SNAPSHOT_WAIT_MS = 20000;
const PAGE_GAP = 16;

export function AlbumShareScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { loading, album, entries, stats, title, day, yearsApart, allSectors, places } = useAlbum(id);
  const [format, setFormat] = useState<AlbumSlideFormat>('post');
  const [page, setPage] = useState(0);
  const [snapshot, setSnapshot] = useState<string>();
  const [snapshotTried, setSnapshotTried] = useState(false);
  const [snapshotGaveUp, setSnapshotGaveUp] = useState(false);
  const [loadedByFormat, setLoadedByFormat] = useState<Partial<Record<AlbumSlideFormat, number>>>({});
  const [waitedByFormat, setWaitedByFormat] = useState<Partial<Record<AlbumSlideFormat, boolean>>>({});
  const [busy, setBusy] = useState<'save' | 'share'>();
  const slideRefs = useRef<(View | null)[]>([]);
  const snapshotMapRef = useRef<MapView>(null);

  const pairs: AlbumSlidePair[] = useMemo(
    () =>
      entries.map((entry) => ({
        key: entry.capture.id,
        reference: entry.reference,
        current: entry.current,
        referenceYear: entry.referenceYear,
        currentYear: entry.currentYear,
        place: entry.label,
        referenceCredit: entry.referenceCredit,
      })),
    [entries],
  );
  const route: RouteStep[] = useMemo(
    () =>
      entries
        .map((entry, index) => (entry.capture.coordinate ? { ...entry.capture.coordinate, index } : undefined))
        .filter((point): point is RouteStep => Boolean(point)),
    [entries],
  );
  const region = useMemo(() => squareRegionFor(route), [route]);
  const map: AlbumSlideMap | undefined = region
    ? {
        snapshot,
        region,
        route,
        pins: groupRouteStops(route).map((stop) => ({ ...stop, photo: entries[stop.steps[0]].current })),
      }
    : undefined;

  const coverStats = [
    { label: stats && stats.count > 1 ? 'Photos refaites' : 'Photo refaite', value: String(stats?.count ?? 0) },
    ...(stats?.distance ? [{ label: 'De balade', value: stats.distance }] : []),
    ...(yearsApart ? [{ label: 'D’écart', value: `${yearsApart} ans` }] : []),
    {
      label: allSectors ? (places.length > 1 ? 'Secteurs' : 'Secteur') : places.length > 1 ? 'Lieux' : 'Lieu',
      value: allSectors ? places.map((place) => place.replace(/^Secteur /, '')).join(', ') : String(places.length),
    },
  ];

  const slideCount = pairs.length + 1;
  const expectedImages =
    pairs.reduce((total, pair) => total + (pair.reference ? 2 : 1), 0) +
    (map ? (map.snapshot ? 1 : 0) + map.pins.length : 2);
  const waited = Boolean(waitedByFormat[format]);
  const ready = (!map || snapshotTried || snapshotGaveUp) && ((loadedByFormat[format] ?? 0) >= expectedImages || waited);

  useEffect(() => {
    const timer = setTimeout(
      () => setWaitedByFormat((current) => ({ ...current, [format]: true })),
      IMAGE_WAIT_MS,
    );
    return () => clearTimeout(timer);
  }, [format]);

  useEffect(() => {
    const timer = setTimeout(() => setSnapshotGaveUp(true), SNAPSHOT_WAIT_MS);
    return () => clearTimeout(timer);
  }, []);

  const onImageLoad = useCallback(
    () => setLoadedByFormat((current) => ({ ...current, [format]: (current[format] ?? 0) + 1 })),
    [format],
  );
  const registerSlide = useCallback((index: number, node: View | null) => {
    slideRefs.current[index] = node;
  }, []);

  // L'image satellite de la couverture, produite par une carte invisible sur l'emprise de la balade.
  const takeMapSnapshot = useCallback(async () => {
    if (!region || snapshotTried) return;
    try {
      const uri = await snapshotMapRef.current?.takeSnapshot({
        // En points : l'image sort à l'échelle de l'écran, soit 1080 px, la largeur des pages.
        width: 360,
        height: 360,
        region,
        format: 'jpg',
        quality: 0.88,
        result: 'file',
      });
      // Le module renvoie un chemin nu : expo-image a besoin du schéma file://.
      if (uri) setSnapshot(uri.startsWith('/') ? `file://${uri}` : uri);
    } catch {
      // Sans image, la couverture garde le tracé et les repères sur fond bleu nuit.
    } finally {
      setSnapshotTried(true);
    }
  }, [region, snapshotTried]);

  const capture = async (indexes: readonly number[]) => {
    const uris: string[] = [];
    for (const index of indexes) {
      const node = slideRefs.current[index];
      if (!node) continue;
      uris.push(await captureRef(node, { format: 'jpg', quality: 0.92, result: 'tmpfile' }));
    }
    return uris;
  };

  const saveAll = async () => {
    if (busy || !ready) return;
    setBusy('save');
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const saved = await saveImagesToLibrary(await capture([...Array(slideCount).keys()]));
      if (saved === 0) {
        Alert.alert('Photos inaccessible', 'Autorisez Paris GO à ajouter des photos dans Réglages pour enregistrer la balade.');
        return;
      }
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        `${saved} images enregistrées`,
        format === 'post'
          ? 'Elles sont dans Photos, dans l’ordre : sélectionnez-les ensemble pour publier un carrousel.'
          : 'Elles sont dans Photos, dans l’ordre, prêtes pour vos stories.',
      );
    } catch {
      Alert.alert('Enregistrement impossible', 'Les images de la balade n’ont pas pu être préparées.');
    } finally {
      setBusy(undefined);
    }
  };

  const shareCurrent = async () => {
    if (busy || !ready) return;
    setBusy('share');
    try {
      const [uri] = await capture([page]);
      if (!uri || !(await Sharing.isAvailableAsync())) throw new Error('unavailable');
      await Sharing.shareAsync(uri, { dialogTitle: `Partager · ${title}`, mimeType: 'image/jpeg', UTI: 'public.jpeg' });
    } catch {
      Alert.alert('Partage indisponible', 'Cette image de la balade n’a pas pu être partagée.');
    } finally {
      setBusy(undefined);
    }
  };

  const size = ALBUM_SLIDE_SIZE[format];
  const previewWidth = format === 'post' ? Math.min(340, width - 64) : Math.min(260, width - 130);
  const previewHeight = (previewWidth / size.width) * size.height;
  const interval = previewWidth + PAGE_GAP;

  if (loading || !album || !stats) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Palette.parisBlue} />
      </View>
    );
  }

  const deck = (deckWidth: number | undefined, withRefs: boolean) => [
    <AlbumCoverSlide
      key="cover"
      ref={withRefs ? (node) => registerSlide(0, node) : undefined}
      format={format}
      width={deckWidth}
      title={title}
      day={day}
      stats={coverStats}
      map={map}
      fallbackCover={pairs[0]}
      onImageLoad={withRefs ? onImageLoad : undefined}
    />,
    ...pairs.map((pair, index) => (
      <AlbumPairSlide
        key={pair.key}
        ref={withRefs ? (node) => registerSlide(index + 1, node) : undefined}
        format={format}
        width={deckWidth}
        pair={pair}
        position={index + 1}
        total={pairs.length}
        onImageLoad={withRefs ? onImageLoad : undefined}
      />
    )),
  ];

  return (
    <View style={[styles.screen, { paddingBottom: insets.bottom + Spacing.three }]}>
      {region ? (
        <MapView
          ref={snapshotMapRef}
          pointerEvents="none"
          style={styles.snapshotMap}
          mapType="satellite"
          initialRegion={region}
          onMapReady={() => void takeMapSnapshot()}
        />
      ) : null}

      {/* Les pages en taille réelle, hors écran : ce sont elles que l'on photographie. */}
      <View
        key={format}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        pointerEvents="none"
        style={[styles.captureHost, { width: size.width }]}>
        {deck(undefined, true)}
      </View>

      <View style={styles.header}>
        <View style={styles.headerSide} />
        <Text style={styles.title}>Partager la balade</Text>
        <Pressable
          accessibilityLabel="Fermer"
          hitSlop={10}
          onPress={() => router.back()}
          style={({ pressed }) => [styles.headerSide, styles.close, pressed && styles.pressed]}>
          <SymbolView name="xmark" size={20} weight="semibold" tintColor={Palette.ink} />
        </Pressable>
      </View>

      <View style={styles.formats}>
        {FORMATS.map((option) => {
          const active = option.key === format;
          return (
            <Pressable
              key={option.key}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => {
                void Haptics.selectionAsync();
                setFormat(option.key);
              }}
              style={[styles.format, active && styles.formatActive]}>
              <Text style={[styles.formatText, active && styles.formatTextActive]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={{ height: previewHeight + 24 }}>
        <ScrollView
          key={`preview-${format}`}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={interval}
          decelerationRate="fast"
          disableIntervalMomentum
          contentContainerStyle={{ paddingHorizontal: (width - previewWidth) / 2, gap: PAGE_GAP, paddingVertical: 12 }}
          onMomentumScrollEnd={(event) => {
            const next = Math.round(event.nativeEvent.contentOffset.x / interval);
            if (next !== page) void Haptics.selectionAsync();
            setPage(next);
          }}>
          {deck(previewWidth, false).map((slide) => (
            <View key={slide.key} style={[styles.preview, { borderRadius: 20 * (previewWidth / size.width) * 1.2 }]}>
              {slide}
            </View>
          ))}
        </ScrollView>
      </View>

      <View style={styles.dots}>
        {Array.from({ length: slideCount }, (_, index) => (
          <View key={index} style={[styles.dot, index === page && styles.dotActive]} />
        ))}
      </View>

      <Text style={styles.note}>
        {slideCount} images · crédits des archives sur chaque image
      </Text>

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          disabled={!ready || Boolean(busy)}
          onPress={() => void shareCurrent()}
          style={({ pressed }) => [styles.primary, (!ready || busy) && styles.disabled, pressed && styles.pressed]}>
          {busy === 'share' || !ready ? (
            <ActivityIndicator color={Palette.white} />
          ) : (
            <SymbolView name="square.and.arrow.up" size={19} weight="semibold" tintColor={Palette.white} />
          )}
          <Text style={styles.primaryText}>{ready ? 'Partager' : 'Préparation…'}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Enregistrer les ${slideCount} images dans Photos`}
          disabled={!ready || Boolean(busy)}
          onPress={() => void saveAll()}
          style={({ pressed }) => [styles.secondary, (!ready || busy) && styles.disabled, pressed && styles.pressed]}>
          {busy === 'save' ? (
            <ActivityIndicator color={Palette.ink} />
          ) : (
            <SymbolView name="arrow.down.to.line" size={19} weight="semibold" tintColor={Palette.ink} />
          )}
          <Text style={styles.secondaryText}>Tout enregistrer</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Palette.white },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Palette.white },
  snapshotMap: { position: 'absolute', top: 0, left: -2000, width: 240, height: 240 },
  captureHost: { position: 'absolute', top: 0, left: -10000 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.three, paddingTop: Spacing.four, paddingBottom: Spacing.two },
  headerSide: { width: 44, height: 44 },
  close: { alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, textAlign: 'center', color: Palette.ink, fontFamily: Fonts.display, fontWeight: '800', fontSize: 24, lineHeight: 28 },
  formats: { alignSelf: 'center', flexDirection: 'row', padding: 3, gap: 2, borderRadius: Radius.pill, backgroundColor: Palette.fog, marginTop: Spacing.one },
  format: { minHeight: 34, paddingHorizontal: Spacing.three, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
  formatActive: { backgroundColor: Palette.ink },
  formatText: { ...Typography.caption, color: Palette.inkSoft, fontFamily: Fonts.sans, fontWeight: '700' },
  formatTextActive: { color: Palette.white },
  preview: {
    overflow: 'hidden',
    backgroundColor: Palette.blueDeep,
    shadowColor: Palette.blueDeep,
    shadowOpacity: 0.28,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
  },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: Spacing.one },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Palette.line },
  dotActive: { width: 18, backgroundColor: Palette.go },
  note: { ...Typography.caption, marginTop: Spacing.twoHalf, textAlign: 'center', color: Palette.inkSoft, fontFamily: Fonts.sans },
  actions: { marginTop: 'auto', flexDirection: 'row', gap: Spacing.twoHalf, paddingHorizontal: Spacing.four, paddingTop: Spacing.three },
  primary: { flex: 1, minHeight: 58, borderRadius: Radius.pill, backgroundColor: Palette.ink, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.two },
  primaryText: { color: Palette.white, fontFamily: Fonts.sans, fontWeight: '700', fontSize: 17, lineHeight: 22 },
  secondary: { flex: 1, minHeight: 58, borderRadius: Radius.pill, borderWidth: 1.5, borderColor: Palette.line, backgroundColor: Palette.white, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.two },
  secondaryText: { color: Palette.ink, fontFamily: Fonts.sans, fontWeight: '700', fontSize: 17, lineHeight: 22 },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
});
