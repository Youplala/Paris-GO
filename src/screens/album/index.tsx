import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActionSheetIOS,
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import MapView, { Marker, Polyline, type MapType } from 'react-native-maps';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { PhotoPin } from '@/components/album/photo-pin';
import { StepCarousel, type AlbumStep, type StepCarouselHandle } from '@/components/album/step-carousel';
import { StepScrubber } from '@/components/album/step-scrubber';
import { GlassLabelButton } from '@/components/glass-icon-button';
import { IconButton } from '@/components/ui/icon-button';
import { Fonts, HitSize, Kicker, Palette, Radius, Shadow, Spacing, Typography } from '@/constants/theme';
import { useAlbum } from '@/hooks/use-album';
import { groupRouteStops, partialRoute, type RouteStep } from '@/services/album-route';
import { ALBUM_TITLE_MAX_LENGTH, normalizeAlbumTitle } from '@/services/album-titles';
import { albumTitleStore } from '@/services/album-title-store';
import { defaultAlbumTitle } from '@/services/albums';

/** Durées de la balade rejouée : la photo de 1970, puis la reprise, puis l'étape suivante. */
const PLAY_ARCHIVE_MS = 1700;
const PLAY_STEP_MS = 3600;
const ROUTE_DRAW_MS = 1600;
const STEP_CAMERA = { pitch: 58, altitude: 520, zoom: 17.4 };

export function AlbumScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { id } = useLocalSearchParams<{ id: string }>();
  const mapRef = useRef<MapView>(null);
  const carouselRef = useRef<StepCarouselHandle>(null);
  const { loading, album, entries, stats, title, customTitle, setCustomTitle, day, yearsApart } = useAlbum(id);
  const [renaming, setRenaming] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [selected, setSelected] = useState(0);
  const [archiveIndex, setArchiveIndex] = useState<number>();
  const [playing, setPlaying] = useState(false);
  const [routeProgress, setRouteProgress] = useState(0);
  const [mapType, setMapType] = useState<MapType>('mutedStandard');
  const mapReady = useRef(false);
  const albumCaptures = useMemo(() => entries.map((entry) => entry.capture), [entries]);
  const steps: AlbumStep[] = useMemo(
    () =>
      entries.map((entry) => ({
        key: entry.capture.id,
        title: entry.title,
        subtitle: entry.subtitle,
        current: entry.current,
        reference: entry.reference,
        referenceYear: entry.referenceYear,
        currentYear: entry.currentYear,
      })),
    [entries],
  );

  const route: RouteStep[] = useMemo(
    () =>
      albumCaptures
        .map((capture, index) => (capture.coordinate ? { ...capture.coordinate, index } : undefined))
        .filter((point): point is RouteStep => Boolean(point)),
    [albumCaptures],
  );
  const stops = useMemo(() => groupRouteStops(route), [route]);
  const drawnRoute = useMemo(() => partialRoute(route, routeProgress), [route, routeProgress]);

  const mapPadding = { top: insets.top + 150, bottom: 360 + insets.bottom, left: 32, right: 32 };

  const flyToStep = useCallback(
    (index: number) => {
      const point = albumCaptures[index]?.coordinate;
      if (!point) return;
      mapRef.current?.animateCamera(
        { center: point, heading: 0, ...STEP_CAMERA },
        { duration: 1100 },
      );
    },
    [albumCaptures],
  );

  const flyToOverview = useCallback(() => {
    if (route.length === 0) return;
    if (route.length === 1) {
      mapRef.current?.animateCamera({ center: route[0], heading: 0, pitch: 45, altitude: 1400, zoom: 16 }, { duration: 1200 });
      return;
    }
    mapRef.current?.fitToCoordinates(route, {
      edgePadding: { top: 60, right: 60, bottom: 60, left: 60 },
      animated: true,
    });
  }, [route]);

  // L'ouverture : la carte se cadre sur la balade, puis le trait de la marche se dessine.
  const introDone = useRef(false);
  const startIntro = useCallback(() => {
    if (introDone.current || route.length === 0) return;
    introDone.current = true;
    flyToOverview();
    const started = Date.now() + 700;
    const tick = () => {
      const progress = Math.min(1, Math.max(0, (Date.now() - started) / ROUTE_DRAW_MS));
      setRouteProgress(progress);
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [flyToOverview, route.length]);

  useEffect(() => {
    if (route.length && mapReady.current) startIntro();
  }, [route.length, startIntro]);

  const selectStep = useCallback(
    (index: number, { scroll = true, fly = true } = {}) => {
      setSelected(index);
      setArchiveIndex(undefined);
      if (scroll) carouselRef.current?.scrollToIndex(index);
      if (fly) flyToStep(index);
    },
    [flyToStep],
  );

  // « Revivre la balade » : la caméra vole d'une reprise à l'autre, chaque carte montre d'abord
  // la photo de 1970, puis se fond dans celle d'aujourd'hui.
  useEffect(() => {
    if (!playing) return;
    const showToday = setTimeout(() => setArchiveIndex(undefined), PLAY_ARCHIVE_MS);
    const next = setTimeout(() => {
      if (selected >= steps.length - 1) {
        setPlaying(false);
        setArchiveIndex(undefined);
        flyToOverview();
        return;
      }
      const index = selected + 1;
      setSelected(index);
      setArchiveIndex(index);
      carouselRef.current?.scrollToIndex(index);
      flyToStep(index);
    }, PLAY_STEP_MS);
    return () => {
      clearTimeout(showToday);
      clearTimeout(next);
    };
  }, [flyToOverview, flyToStep, playing, selected, steps.length]);

  const togglePlay = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (playing) {
      setPlaying(false);
      setArchiveIndex(undefined);
      return;
    }
    const start = selected >= steps.length - 1 ? 0 : selected;
    setSelected(start);
    setArchiveIndex(start);
    carouselRef.current?.scrollToIndex(start);
    flyToStep(start);
    setPlaying(true);
  };

  const trackWidth = width - Spacing.three * 2;

  const openCapture = (index: number) => {
    const capture = albumCaptures[index];
    if (!capture) return;
    setPlaying(false);
    router.push({
      pathname: '/capture-review',
      params: {
        captureId: capture.id,
        id: capture.stationId,
        frame: String(capture.frameIndex),
        uri: capture.imageUri ?? '',
        simulated: '0',
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

  const openShare = () => {
    if (!album) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPlaying(false);
    router.push({ pathname: '/album-share/[id]', params: { id: album.id } });
  };

  // Les réglages secondaires restent à portée, sans encombrer la carte.
  const openMenu = () => {
    void Haptics.selectionAsync();
    const satellite = mapType === 'hybridFlyover';
    const actions = [
      { label: satellite ? 'Afficher le plan' : 'Vue satellite', run: () => setMapType(satellite ? 'mutedStandard' : 'hybridFlyover') },
      { label: 'Voir toute la balade', run: () => { setPlaying(false); flyToOverview(); } },
      { label: 'Renommer la balade', run: startRename },
    ];
    ActionSheetIOS.showActionSheetWithOptions(
      { options: [...actions.map((action) => action.label), 'Annuler'], cancelButtonIndex: actions.length },
      (index) => actions[index]?.run(),
    );
  };

  const startRename = () => {
    void Haptics.selectionAsync();
    setDraftTitle(title);
    setRenaming(true);
  };

  const saveTitle = async (value: string) => {
    if (!album) return;
    const clean = normalizeAlbumTitle(value);
    const next = clean === defaultAlbumTitle(album) ? '' : clean;
    const titles = await albumTitleStore.rename(album.id, next);
    setCustomTitle(titles[album.id]);
    setRenaming(false);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Palette.white} />
      </View>
    );
  }

  if (!album || !stats) {
    return (
      <SafeAreaView style={styles.center}>
        <SymbolView name="book.closed" size={30} tintColor={Palette.brass} />
        <Text style={styles.emptyTitle}>Balade introuvable</Text>
        <Text style={styles.emptyCopy}>Ses reprises ont peut-être été supprimées du carnet.</Text>
        <Pressable onPress={() => router.back()} style={styles.emptyButton}>
          <Text style={styles.emptyButtonText}>Revenir au carnet</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const summary = [
    `${stats.count} ${stats.count > 1 ? 'reprises' : 'reprise'}`,
    stats.distance,
    yearsApart ? `${yearsApart} ans d’écart` : undefined,
  ].filter(Boolean).join(' · ');

  return (
    <View style={styles.screen}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        mapType={mapType}
        userInterfaceStyle="dark"
        showsPointsOfInterests={false}
        showsCompass={false}
        showsBuildings
        pitchEnabled
        rotateEnabled
        mapPadding={mapPadding}
        initialCamera={{
          center: route[0] ?? { latitude: 48.8566, longitude: 2.3522 },
          heading: 0,
          pitch: 0,
          altitude: 9000,
          zoom: 12,
        }}
        onMapReady={() => {
          mapReady.current = true;
          startIntro();
        }}
        onPanDrag={() => setPlaying(false)}>
        {drawnRoute.length > 1 ? (
          <>
            <Polyline coordinates={drawnRoute} strokeColor="rgba(8, 17, 22, 0.35)" strokeWidth={5.5} lineCap="round" lineJoin="round" />
            <Polyline coordinates={drawnRoute} strokeColor={Palette.white} strokeWidth={2.5} lineCap="round" lineJoin="round" />
          </>
        ) : null}
        {stops.map((stop, order) => {
          const isSelected = stop.steps.includes(selected);
          const firstStep = isSelected ? selected : stop.steps[0];
          return (
            <Marker
              key={stop.label}
              coordinate={stop}
              anchor={{ x: 0.5, y: 0.5 }}
              zIndex={isSelected ? 10 : 1}
              tracksViewChanges
              onPress={() => {
                void Haptics.selectionAsync();
                setPlaying(false);
                const next = isSelected && stop.steps.length > 1
                  ? stop.steps[(stop.steps.indexOf(selected) + 1) % stop.steps.length]
                  : firstStep;
                selectStep(next);
              }}>
              <PhotoPin
                source={steps[firstStep]?.current}
                selected={isSelected}
                stacked={stop.steps.length - 1}
                order={order}
              />
            </Marker>
          );
        })}
      </MapView>

      {/* Voiles haut et bas : le titre et les cartes se lisent sur n'importe quel fond de carte. */}
      {TOP_SHADES.map((height) => (
        <View key={`t${height}`} pointerEvents="none" style={[styles.topShade, { height: height + insets.top }]} />
      ))}
      {BOTTOM_SHADES.map((height) => (
        <View key={`b${height}`} pointerEvents="none" style={[styles.bottomShade, { height: height + insets.bottom }]} />
      ))}

      <View style={[styles.header, { paddingTop: insets.top + Spacing.two }]} pointerEvents="box-none">
        <IconButton icon="chevron.left" variant="media" accessibilityLabel="Revenir au carnet" onPress={() => router.back()} />
        <View style={styles.titleBlock}>
          <Text style={styles.kicker} numberOfLines={1}>{day}</Text>
          <Text accessibilityRole="header" style={styles.title} numberOfLines={2}>{title}</Text>
          <Text style={styles.summary} numberOfLines={1}>{summary}</Text>
        </View>
        <IconButton icon="ellipsis" variant="media" accessibilityLabel="Plus d’options" onPress={openMenu} />
      </View>

      <View style={[styles.bottom, { paddingBottom: insets.bottom + Spacing.three }]} pointerEvents="box-none">
        <View style={styles.actions}>
          <GlassLabelButton
            systemImage={playing ? 'pause.fill' : 'play.fill'}
            label={playing ? 'Pause' : 'Revivre'}
            accessibilityLabel={playing ? 'Mettre en pause' : 'Revivre la balade'}
            prominent={playing}
            onPress={togglePlay}
          />
          <GlassLabelButton systemImage="square.and.arrow.up" label="Partager" accessibilityLabel="Partager la balade" onPress={openShare} />
        </View>
        <StepScrubber
          count={steps.length}
          index={selected}
          width={trackWidth}
          onScrubStart={() => setPlaying(false)}
          onChange={(index) => selectStep(index)}
        />
        <StepCarousel
          ref={carouselRef}
          steps={steps}
          archiveIndex={archiveIndex}
          onIndexChange={(index) => selectStep(index, { scroll: false })}
          onToggleArchive={(index) => setArchiveIndex((current) => (current === index ? undefined : index))}
          onOpen={openCapture}
          onUserScroll={() => setPlaying(false)}
        />
      </View>

      <Modal animationType="fade" transparent visible={renaming} onRequestClose={() => setRenaming(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.renameRoot}>
          <Pressable accessibilityLabel="Annuler" onPress={() => setRenaming(false)} style={StyleSheet.absoluteFill} />
          <View style={styles.renameCard}>
            <Text style={styles.renameKicker}>RENOMMER LA BALADE</Text>
            <TextInput
              autoFocus
              maxLength={ALBUM_TITLE_MAX_LENGTH}
              onChangeText={setDraftTitle}
              onSubmitEditing={() => void saveTitle(draftTitle)}
              placeholder={defaultAlbumTitle(album)}
              placeholderTextColor={Palette.inkSoft}
              returnKeyType="done"
              selectTextOnFocus
              style={styles.renameInput}
              value={draftTitle}
            />
            <View style={styles.renameActions}>
              {customTitle ? (
                <Pressable onPress={() => void saveTitle('')} style={styles.renameReset}>
                  <Text style={styles.renameResetText}>Titre par défaut</Text>
                </Pressable>
              ) : <View />}
              <Pressable onPress={() => void saveTitle(draftTitle)} style={styles.renameSave}>
                <Text style={styles.renameSaveText}>Enregistrer</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const TOP_SHADES = Array.from({ length: 10 }, (_, step) => Math.round(170 * (1 - step / 10)));
const BOTTOM_SHADES = Array.from({ length: 12 }, (_, step) => Math.round(360 * (1 - step / 12)));

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Palette.black },
  center: { flex: 1, padding: Spacing.four, alignItems: 'center', justifyContent: 'center', backgroundColor: Palette.blueDeep, gap: Spacing.two },
  emptyTitle: { ...Typography.title, color: Palette.white, fontFamily: Fonts.display, fontWeight: '800' },
  emptyCopy: { ...Typography.body, color: 'rgba(255,255,255,0.8)', fontFamily: Fonts.sans, textAlign: 'center' },
  emptyButton: { marginTop: Spacing.three, minHeight: 48, paddingHorizontal: Spacing.four, borderRadius: Radius.pill, backgroundColor: Palette.go, alignItems: 'center', justifyContent: 'center' },
  emptyButtonText: { ...Typography.body, color: Palette.white, fontFamily: Fonts.sans, fontWeight: '700' },
  topShade: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: 'rgba(8, 17, 22, 0.09)' },
  bottomShade: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(8, 17, 22, 0.1)' },
  header: { position: 'absolute', top: 0, left: Spacing.three, right: Spacing.three, flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.twoHalf },
  titleBlock: { flex: 1, alignItems: 'center', paddingTop: 2 },
  actions: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.twoHalf },
  kicker: { ...Kicker, color: Palette.brass, textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 6 },
  title: { marginTop: 2, color: Palette.white, fontFamily: Fonts.display, fontWeight: '800', fontSize: 28, lineHeight: 31, textAlign: 'center', textShadowColor: 'rgba(0,0,0,0.55)', textShadowRadius: 8 },
  summary: { marginTop: 2, color: 'rgba(255,255,255,0.88)', fontFamily: Fonts.sans, fontWeight: '600', fontSize: 13, lineHeight: 17, textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 6 },
  rightColumn: { gap: Spacing.twoHalf, alignItems: 'center' },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, gap: Spacing.three },
  renameRoot: { flex: 1, justifyContent: 'center', padding: Spacing.four, backgroundColor: 'rgba(8, 17, 22, 0.45)' },
  renameCard: { padding: Spacing.three, borderRadius: Radius.large, backgroundColor: Palette.fog, ...Shadow.card },
  renameKicker: { ...Kicker, color: Palette.go },
  renameInput: { ...Typography.title, marginTop: Spacing.two, minHeight: 52, paddingHorizontal: Spacing.twoHalf, borderRadius: Radius.medium, backgroundColor: Palette.white, color: Palette.ink, fontFamily: Fonts.display, fontWeight: '800' },
  renameActions: { marginTop: Spacing.three, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  renameReset: { minHeight: HitSize, justifyContent: 'center' },
  renameResetText: { ...Typography.caption, color: Palette.inkSoft, fontFamily: Fonts.sans, fontWeight: '700' },
  renameSave: { minHeight: HitSize, paddingHorizontal: Spacing.four, borderRadius: Radius.pill, backgroundColor: Palette.go, alignItems: 'center', justifyContent: 'center' },
  renameSaveText: { ...Typography.body, color: Palette.white, fontFamily: Fonts.sans, fontWeight: '700' },
});
