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
import { IconButton } from '@/components/ui/icon-button';
import { PrimaryButton } from '@/components/primary-button';
import { SIMULATED_CAMERA_IMAGE } from '@/constants/demo';
import { Fonts, Kicker, Palette, Spacing, Typography } from '@/constants/theme';
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
            <IconButton icon="xmark" variant="media" accessibilityLabel="Fermer" onPress={() => router.back()} />
            <IconButton icon="square.and.arrow.up" variant="media" accessibilityLabel="Partager" onPress={() => void share()} />
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

          {!isSimulated && !captureLocation ? (
            <View style={styles.notice}>
              <SymbolView name="location.slash" size={16} tintColor={Palette.go} />
              <Text style={styles.noticeText}>Position non enregistrée : le formulaire officiel vous la demandera.</Text>
            </View>
          ) : null}

          {saved ? (
            <>
              <Animated.View entering={ZoomIn.springify().damping(12)} style={styles.confirmation}>
                <SymbolView name="checkmark.circle.fill" size={22} tintColor={Palette.lichenDeep} />
                <Text style={styles.confirmationText}>
                  {isSimulated
                    ? 'Aperçu gardé dans le carnet. Aucune vraie photo n’a été prise.'
                    : inLibrary
                      ? 'Gardée dans votre carnet et dans Photos (Récents).'
                      : 'Gardée dans votre carnet.'}
                </Text>
              </Animated.View>
              {/* La contribution vient après, et elle est facultative. */}
              <View style={styles.contribute}>
                <PrimaryButton
                  label="Contribuer à l’Observatoire"
                  icon="paperplane.fill"
                  variant="secondary"
                  onPress={openObservatoire}
                />
                <Text style={styles.help}>Facultatif : vous vérifiez puis envoyez vous-même.</Text>
              </View>
            </>
          ) : (
            <>
              <PrimaryButton
                label={isSimulated ? 'Garder l’aperçu' : 'Garder dans mon carnet'}
                icon="checkmark"
                loading={saving}
                onPress={save}
                style={styles.primary}
              />
              <Text style={styles.help}>
                {isSimulated
                  ? 'Mode démo : aucune vraie photo n’est prise.'
                  : 'Elle reste sur votre téléphone. Une copie va dans Photos si vous l’autorisez.'}
              </Text>
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
  title: { ...Typography.display, marginTop: Spacing.one, color: Palette.ink, fontFamily: Fonts.display, fontWeight: '800' },
  place: { ...Typography.body, marginTop: Spacing.one, color: Palette.inkSoft, fontFamily: Fonts.sans, fontWeight: '600' },
  primary: { marginTop: Spacing.four },
  notice: { marginTop: Spacing.three, flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  noticeText: { ...Typography.body, flex: 1, color: Palette.ink, fontFamily: Fonts.sans },
  confirmation: { marginTop: Spacing.four, flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  confirmationText: { ...Typography.body, flex: 1, color: Palette.ink, fontFamily: Fonts.sans, fontWeight: '700' },
  contribute: { marginTop: Spacing.four },
  help: { ...Typography.body, marginTop: Spacing.twoHalf, color: Palette.inkSoft, fontFamily: Fonts.sans, textAlign: 'center' },
  saveError: { ...Typography.body, marginTop: Spacing.two, color: Palette.go, fontFamily: Fonts.sans, fontWeight: '700', textAlign: 'center' },
  retake: { minHeight: 52, marginTop: Spacing.three, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.two },
  retakeText: { ...Typography.body, color: Palette.parisBlue, fontFamily: Fonts.sans, fontWeight: '700' },
  pressed: { opacity: 0.7 },
});
