import * as Haptics from 'expo-haptics';
import type { ImageSource } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import Animated, { ZoomIn } from 'react-native-reanimated';

import { BeforeAfterSlider } from '@/components/before-after-slider';
import { CaptureCelebration } from '@/components/capture-celebration';
import { GlassIconButton } from '@/components/glass-icon-button';
import { PrimaryButton } from '@/components/primary-button';
import { SIMULATED_CAMERA_IMAGE } from '@/constants/demo';
import { Fonts, Kicker, Palette, Radius, Spacing, Typography } from '@/constants/theme';
import { useBhvpImages } from '@/hooks/use-bhvp-images';
import { useStationDetail } from '@/hooks/use-station-detail';
import {
  historicalReferenceForFrame,
  referenceUriOf,
  validatedHistoricalReferenceUri,
} from '@/services/camera-reference';
import { saveCapture } from '@/services/fieldbook';
import type { CaptureLocation } from '@/services/review-status';
import { formatContributorName } from '@/utils/community-stats';

export function ReviewScreen() {
  const router = useRouter();
  const { height: windowHeight } = useWindowDimensions();
  const {
    id,
    frame,
    referenceUri,
    uri,
    simulated,
    latitude,
    longitude,
    locationPrecision,
    captureId,
    resumed,
    currentSaved,
    currentPreparation,
    referencePreparation,
  } = useLocalSearchParams<{
    id: string;
    frame?: string;
    referenceUri?: string;
    uri?: string;
    simulated?: string;

    latitude?: string;
    longitude?: string;
    locationPrecision?: string;
    captureId?: string;
    resumed?: string;
    currentSaved?: string;
    currentPreparation?: string;
    referencePreparation?: string;
  }>();
  const { detail } = useStationDetail(id);
  const [saved, setSaved] = useState(resumed === '1');
  const [inLibrary, setInLibrary] = useState(currentSaved === '1');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string>();
  const [savedCaptureUri, setSavedCaptureUri] = useState<string | undefined>(
    resumed === '1' ? uri : undefined,
  );
  const [savedCaptureId, setSavedCaptureId] = useState<string | undefined>(captureId);
  const [savedCoordinate, setSavedCoordinate] = useState<{
    latitude: number;
    longitude: number;
  }>();
  const [comparisonActive, setComparisonActive] = useState(false);
  const [celebrationDone, setCelebrationDone] = useState(false);
  const isSimulated = simulated !== '0';
  const isArchiveSector = detail?.kind === 'archive-1970';
  const { images: archiveImages } = useBhvpImages(
    isArchiveSector ? detail?.archiveLinks : undefined,
  );
  const stationImages = archiveImages.length > 0 ? archiveImages : detail?.images ?? [];

  const requestedFrame = Number.parseInt(frame ?? '0', 10);
  const historicalReference = historicalReferenceForFrame({
    images: stationImages,
    recaptureImage: detail?.recaptureImage,
    referenceImage: detail?.referenceImage,
    requestedFrame,
  });
  const frameIndex = historicalReference.frameIndex;
  const transportedReferenceUri = validatedHistoricalReferenceUri({
    candidateUri: referenceUri,
    images: stationImages,
    recaptureImage: detail?.recaptureImage,
    referenceImage: detail?.referenceImage,
  });
  const referenceImage =
    transportedReferenceUri
      ? { uri: transportedReferenceUri }
      : historicalReference.image;
  const currentImage: ImageSource | undefined = uri
    ? { uri }
    : isSimulated
      ? SIMULATED_CAMERA_IMAGE
      : detail?.recaptureImage;
  const latitudeValue = Number(latitude);
  const longitudeValue = Number(longitude);
  const captureLocation: CaptureLocation | undefined =
    Number.isFinite(latitudeValue) &&
    Number.isFinite(longitudeValue) &&
    (locationPrecision === 'precise' || locationPrecision === 'approximate')
      ? { latitude: latitudeValue, longitude: longitudeValue, precision: locationPrecision }
      : undefined;

  const save = async () => {
    setSaving(true);
    setSaveError(undefined);
    try {
      const { capture, savedToLibrary } = await saveCapture({
        stationId: id,
        stationName: detail?.name,
        stationAddress: detail?.address,
        frameIndex,
        imageUri: uri || undefined,
        simulated: isSimulated,

        coordinate: captureLocation
          ? { latitude: captureLocation.latitude, longitude: captureLocation.longitude }
          : undefined,
        locationPrecision: captureLocation?.precision,
      });
      setInLibrary(savedToLibrary);
      setSavedCaptureUri(capture.imageUri);
      setSavedCaptureId(capture.id);
      setSavedCoordinate(capture.coordinate);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSaved(true);
    } catch {
      setSaveError('La photo n’a pas pu être ajoutée au carnet. Réessayez.');
    } finally {
      setSaving(false);
    }
  };

  const openObservatoire = () => {
    const captureUri = savedCaptureUri ?? uri ?? '';
    router.push({
      pathname: '/official-submit' as never,
      params: {
        id,
        captureId: savedCaptureId ?? '',
        frame: String(frameIndex),
        referenceUri: referenceUriOf(referenceImage) ?? '',
        uri: captureUri,
        simulated: isSimulated ? '1' : '0',
        currentSaved: saved && inLibrary ? '1' : '0',
        currentPreparation: currentPreparation ?? '',
        referencePreparation: referencePreparation ?? '',
        latitude: savedCoordinate
          ? String(savedCoordinate.latitude)
          : captureLocation
            ? String(captureLocation.latitude)
            : '',
        longitude: savedCoordinate
          ? String(savedCoordinate.longitude)
          : captureLocation
            ? String(captureLocation.longitude)
            : '',
      },
    });
  };

  const share = () =>
    Share.share({
      message: `J’ai retrouvé un point de vue de ${detail?.year ?? 1970} à Paris avec Paris GO.`,
      url: savedCaptureUri ?? uri,
    });

  // Si l'archive ne se charge pas (hors ligne), on n'attend pas la fête indéfiniment.
  const hasReference = Boolean(referenceImage);
  useEffect(() => {
    if (resumed === '1' || hasReference) return;
    const timer = setTimeout(() => setCelebrationDone(true), 5000);
    return () => clearTimeout(timer);
  }, [hasReference, resumed]);

  const archiveMetadata = isArchiveSector ? detail?.archiveMetadata[frameIndex] : detail?.referenceMetadata;
  const placeTitle = isArchiveSector
    ? `Secteur ${detail?.name ?? ''} · photo ${frameIndex + 1}`
    : detail?.name ?? 'Point de vue';
  const archiveAuthor = archiveMetadata?.author && !/non identifi/i.test(archiveMetadata.author)
    ? formatContributorName(archiveMetadata.author)
    : undefined;
  const yearsApart = 2026 - (detail?.year ?? 1970);
  // Des pastilles en langage courant : vert quand c'est bon, orange seulement s'il manque quelque chose.
  const chips: { icon: 'location.fill' | 'location.slash.fill' | 'book.closed.fill' | 'photo.fill' | 'iphone'; label: string; tone: 'ok' | 'warn' | 'neutral' }[] = [
    isSimulated
      ? { icon: 'iphone', label: 'Mode démo', tone: 'neutral' }
      : captureLocation
        ? { icon: 'location.fill', label: 'Position enregistrée', tone: 'ok' }
        : { icon: 'location.slash.fill', label: 'Position manquante', tone: 'warn' },
    ...(saved ? [{ icon: 'book.closed.fill' as const, label: 'Dans le carnet', tone: 'ok' as const }] : []),
    ...(saved && inLibrary ? [{ icon: 'photo.fill' as const, label: 'Dans Photos', tone: 'ok' as const }] : []),
  ];
  const step = saved ? 2 : 1;
  // La fête n'a lieu qu'une fois, juste après la prise de vue ; jamais en rouvrant le carnet.
  const celebrate = resumed !== '1' && !celebrationDone;

  return (
    <View style={styles.screen}>
      <ScrollView
        scrollEnabled={!comparisonActive}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}>
        {/* La comparaison est le sujet de l'écran : grande, bord à bord, les boutons posés dessus. */}
        <View>
          {referenceImage && currentImage ? (
            <BeforeAfterSlider
              before={referenceImage}
              after={currentImage}
              beforeLabel={String(detail?.year ?? 1970)}
              afterLabel={isSimulated ? 'DÉMO' : '2026'}
              borderRadius={0}
              height={Math.round(windowHeight * 0.52)}
              labelsPosition="bottom"
              onInteractionChange={setComparisonActive}
            />
          ) : (
            <View style={[styles.comparisonPlaceholder, { height: Math.round(windowHeight * 0.52) }]} />
          )}
          <View pointerEvents="box-none" style={styles.overlay}>
            <GlassIconButton systemImage="xmark" accessibilityLabel="Fermer" onPress={() => router.back()} size={46} />
            <GlassIconButton systemImage="square.and.arrow.up" accessibilityLabel="Partager" onPress={() => void share()} size={46} />
          </View>
        </View>

        <View style={styles.body}>
          <Text style={styles.kicker}>{isSimulated ? 'APERÇU' : `${yearsApart} ANS PLUS TARD`}</Text>
          <Text accessibilityRole="header" style={styles.title}>
            {isSimulated ? 'Voici l’aperçu.' : 'Bravo, c’est refait !'}
          </Text>
          <Text style={styles.place}>
            {placeTitle}
            {archiveAuthor ? ` · par ${archiveAuthor}` : ''}
          </Text>

          <View style={styles.chips}>
            {chips.map((chip) => (
              <Animated.View
                key={chip.label}
                entering={ZoomIn.springify().damping(12)}
                style={[styles.chip, chip.tone === 'ok' ? styles.chipOk : chip.tone === 'warn' ? styles.chipWarn : styles.chipNeutral]}>
                <SymbolView
                  name={chip.icon}
                  size={14}
                  tintColor={chip.tone === 'ok' ? Palette.lichen : chip.tone === 'warn' ? Palette.go : Palette.parisBlue}
                />
                <Text style={[styles.chipText, chip.tone === 'warn' && styles.chipTextWarn]}>{chip.label}</Text>
              </Animated.View>
            ))}
          </View>

          {/* Deux étapes, toujours dans le même ordre : garder la photo, puis l'envoyer. */}
          <View style={styles.steps} accessibilityRole="progressbar" accessibilityValue={{ min: 1, max: 2, now: step }}>
            {['Garder ma photo', 'Envoyer à l’Observatoire'].map((label, index) => {
              const done = index + 1 < step;
              const current = index + 1 === step;
              return (
                <View key={label} style={styles.step}>
                  <View style={[styles.stepDot, done && styles.stepDotDone, current && styles.stepDotCurrent]}>
                    {done ? (
                      <SymbolView name="checkmark" size={13} weight="bold" tintColor={Palette.white} />
                    ) : (
                      <Text style={[styles.stepNumber, current && styles.stepNumberCurrent]}>{index + 1}</Text>
                    )}
                  </View>
                  <Text style={[styles.stepLabel, (current || done) && styles.stepLabelActive]}>{label}</Text>
                </View>
              );
            })}
          </View>

          {saved ? (
            <>
              <PrimaryButton
                label="Envoyer à l’Observatoire"
                icon="paperplane.fill"
                onPress={openObservatoire}
                style={styles.primary}
              />
              <Text style={styles.help}>
                {isSimulated
                  ? 'Aperçu ajouté au carnet. Aucune photo créée en mode démo.'
                  : inLibrary
                    ? 'Votre photo est dans votre carnet et dans Photos (Récents). Le formulaire est prérempli : vous n’avez plus qu’à vérifier et envoyer.'
                    : 'Votre photo est dans votre carnet. Le formulaire est prérempli : vous n’avez plus qu’à vérifier et envoyer.'}
              </Text>
            </>
          ) : (
            <>
              <PrimaryButton
                label="Garder ma photo"
                icon="checkmark"
                loading={saving}
                onPress={save}
                style={styles.primary}
              />
              <Text style={styles.help}>Elle va dans votre carnet et dans vos Photos.</Text>
            </>
          )}
          {saveError ? <Text style={styles.saveError}>{saveError}</Text> : null}

          <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.retake, pressed && styles.pressed]}>
            <SymbolView name="camera.rotate" size={17} tintColor={Palette.parisBlue} />
            <Text style={styles.retakeText}>Refaire la photo</Text>
          </Pressable>
        </View>
      </ScrollView>
      {celebrate && referenceImage && currentImage ? (
        <CaptureCelebration
          before={referenceImage}
          after={currentImage}
          fromYear={detail?.year ?? 1970}
          toYear={2026}
          place={placeTitle}
          onDone={() => setCelebrationDone(true)}
        />
      ) : celebrate ? (
        // Le temps que l'archive arrive, un fond noir plutôt qu'un écran qui saute.
        <View style={[StyleSheet.absoluteFill, styles.celebrationWait]} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Palette.fog },
  celebrationWait: { backgroundColor: Palette.black },
  content: { paddingBottom: Spacing.six },
  comparisonPlaceholder: { backgroundColor: Palette.blueMist },
  overlay: { position: 'absolute', top: Spacing.three, left: Spacing.three, right: Spacing.three, flexDirection: 'row', justifyContent: 'space-between' },
  body: { paddingHorizontal: Spacing.four, paddingTop: Spacing.four },
  kicker: { ...Kicker, color: Palette.go },
  // Titre de l'écran : un seul niveau « display » par vue.
  title: { ...Typography.display, marginTop: Spacing.one, fontSize: 34, lineHeight: 38, color: Palette.ink, fontFamily: Fonts.display, fontWeight: '800' },
  place: { ...Typography.body, marginTop: Spacing.one, color: Palette.inkSoft, fontFamily: Fonts.sans, fontWeight: '600' },
  chips: { marginTop: Spacing.three, flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: Spacing.twoHalf, paddingVertical: 7, borderRadius: Radius.pill },
  chipOk: { backgroundColor: 'rgba(79, 138, 107, 0.14)' },
  chipWarn: { backgroundColor: Palette.goSoft },
  chipNeutral: { backgroundColor: Palette.blueMist },
  chipText: { ...Typography.caption, fontSize: 15, color: Palette.ink, fontFamily: Fonts.sans, fontWeight: '700' },
  chipTextWarn: { color: Palette.go },
  steps: { marginTop: Spacing.four, flexDirection: 'row', gap: Spacing.three },
  step: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  stepDot: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: Palette.line, alignItems: 'center', justifyContent: 'center', backgroundColor: Palette.white },
  stepDotCurrent: { borderColor: Palette.go, backgroundColor: Palette.go },
  stepDotDone: { borderColor: Palette.lichen, backgroundColor: Palette.lichen },
  stepNumber: { color: Palette.inkSoft, fontFamily: Fonts.display, fontWeight: '800', fontSize: 15, lineHeight: 18 },
  stepNumberCurrent: { color: Palette.white },
  stepLabel: { ...Typography.caption, flex: 1, fontSize: 15, lineHeight: 19, color: Palette.inkSoft, fontFamily: Fonts.sans, fontWeight: '600' },
  stepLabelActive: { color: Palette.ink, fontWeight: '700' },
  primary: { marginTop: Spacing.three },
  help: { ...Typography.body, marginTop: Spacing.twoHalf, color: Palette.inkSoft, fontFamily: Fonts.sans, textAlign: 'center' },
  saveError: { ...Typography.body, marginTop: Spacing.two, color: Palette.go, fontFamily: Fonts.sans, fontWeight: '700', textAlign: 'center' },
  retake: { minHeight: 52, marginTop: Spacing.three, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.two },
  retakeText: { ...Typography.body, color: Palette.parisBlue, fontFamily: Fonts.sans, fontWeight: '700' },
  pressed: { opacity: 0.7 },
});
