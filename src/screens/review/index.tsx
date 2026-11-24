import * as Haptics from 'expo-haptics';
import type { ImageSource } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BeforeAfterSlider } from '@/components/before-after-slider';
import { IconButton } from '@/components/icon-button';
import { PrimaryButton } from '@/components/primary-button';
import { SIMULATED_CAMERA_IMAGE } from '@/constants/demo';
import { Fonts, HitSize, Palette, Spacing, Typography } from '@/constants/theme';
import { useBhvpImages } from '@/hooks/use-bhvp-images';
import { useStationDetail } from '@/hooks/use-station-detail';
import {
  historicalReferenceForFrame,
  referenceUriOf,
  validatedHistoricalReferenceUri,
} from '@/services/camera-reference';
import { saveCapture } from '@/services/fieldbook';
import { getLocationNotice, getSaveStatus, type CaptureLocation } from '@/services/review-status';

export function ReviewScreen() {
  const router = useRouter();
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
  const [saved, setSaved] = useState(resumed === '1' || Boolean(captureId));
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
  const locationNotice = getLocationNotice({ simulated: isSimulated, location: captureLocation });
  const saveStatus = getSaveStatus({
    simulated: isSimulated,
    saving,
    saved,
    savedToLibrary: inLibrary,
    failed: Boolean(saveError),
  });

  const save = useCallback(async () => {
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
      setSaveError('SAVE_FAILED');
    } finally {
      setSaving(false);
    }
    // Les valeurs de la photo sont figées à l'arrivée : seule la fiche du lieu peut se charger après.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail?.address, detail?.name, frameIndex, id, isSimulated, uri, latitudeValue, longitudeValue, locationPrecision]);

  // La photo ne doit jamais se perdre : une nouvelle prise s'enregistre dès l'arrivée, une seule
  // fois (le garde-fou résiste aux rendus répétés). Une photo reprise depuis Mes photos l'est déjà.
  const autoSaveStarted = useRef(false);
  const alreadySaved = resumed === '1' || Boolean(captureId);
  useEffect(() => {
    if (alreadySaved || autoSaveStarted.current) return;
    autoSaveStarted.current = true;
    void save();
  }, [alreadySaved, save]);

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
      message: `J’ai refait une photo de ${detail?.year ?? 1970} à Paris avec Paris GO.`,
      url: savedCaptureUri ?? uri,
    });

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={['top']} style={styles.header}>
        <IconButton icon="xmark" accessibilityLabel="Fermer" onPress={() => router.back()} />
        <Text style={styles.headerTitle}>Votre photo</Text>
        <IconButton
          icon="square.and.arrow.up"
          accessibilityLabel="Partager"
          onPress={() => void share()}
        />
      </SafeAreaView>

      <ScrollView
        scrollEnabled={!comparisonActive}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}>
        {/* La comparaison est le sujet de l'écran : elle occupe toute la largeur, sans marge,
            juste sous l'en-tête. Tout ce qui suit n'est que légende. */}
        {referenceImage && currentImage ? (
          <BeforeAfterSlider
            before={referenceImage}
            after={currentImage}
            beforeLabel={String(detail?.year ?? 1970)}
            afterLabel={isSimulated ? 'DÉMO' : '2026'}
            borderRadius={0}
            onInteractionChange={setComparisonActive}
          />
        ) : null}

        <View style={styles.body}>
          <Text style={styles.title}>Le même lieu,{'\n'}deux époques.</Text>

          {saveStatus ? (
            <View
              accessibilityLiveRegion="polite"
              style={styles.statusRow}>
              <SymbolView
                name={
                  saveStatus.tone === 'done'
                    ? 'checkmark.circle.fill'
                    : saveStatus.tone === 'error'
                      ? 'exclamationmark.circle.fill'
                      : 'clock'
                }
                size={16}
                tintColor={saveStatus.tone === 'done' ? Palette.lichen : Palette.inkSoft}
              />
              <Text style={styles.statusText}>{saveStatus.message}</Text>
              {saveStatus.tone === 'error' ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Réessayer l’enregistrement"
                  disabled={saving}
                  hitSlop={8}
                  onPress={() => void save()}
                  style={({ pressed }) => [styles.retry, pressed && styles.pressed]}>
                  <Text style={styles.retryText}>Réessayer</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          {locationNotice ? (
            <View style={styles.statusRow}>
              <SymbolView name={locationNotice.icon} size={16} tintColor={Palette.inkSoft} />
              <Text style={styles.statusText}>{locationNotice.message}</Text>
            </View>
          ) : null}

          {isSimulated ? (
            <Text style={styles.noteText}>
              Cette comparaison utilise une scène parisienne de démonstration. Sur un iPhone, la
              moitié droite affichera la photo réellement prise.
            </Text>
          ) : null}

          <PrimaryButton
            label="Envoyer à l’Observatoire"
            icon="paperplane.fill"
            loading={saving}
            onPress={openObservatoire}
            style={styles.cta}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityHint="Votre photo reste dans Mes photos"
            onPress={() => router.back()}
            style={({ pressed }) => [styles.later, pressed && styles.pressed]}>
            <Text style={styles.laterText}>Plus tard</Text>
          </Pressable>
          <Text style={styles.laterHint}>Vous la retrouverez dans Mes photos.</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Palette.fog,
  },
  header: {
    minHeight: 56,
    paddingHorizontal: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    ...Typography.body,
    color: Palette.ink,
    fontFamily: Fonts.sans,
    fontWeight: '700',
  },
  content: {
    paddingBottom: Spacing.five,
  },
  // Tout ce qui suit la comparaison vit dans cette colonne : la photo, elle, va bord à bord.
  body: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.four,
  },
  // Titre de l'écran : un seul niveau « display » par vue, jamais combiné à « title ».
  title: {
    ...Typography.display,
    color: Palette.ink,
    fontFamily: Fonts.display,
  },
  statusRow: {
    marginTop: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  statusText: {
    ...Typography.caption,
    flex: 1,
    color: Palette.inkSoft,
    fontFamily: Fonts.sans,
  },
  retry: {
    minHeight: HitSize,
    justifyContent: 'center',
  },
  retryText: {
    ...Typography.caption,
    color: Palette.ink,
    fontFamily: Fonts.sans,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  noteText: {
    ...Typography.caption,
    marginTop: Spacing.three,
    color: Palette.inkSoft,
    fontFamily: Fonts.sans,
  },
  cta: {
    marginTop: Spacing.four,
  },
  later: {
    minHeight: HitSize,
    marginTop: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
  },
  laterText: {
    ...Typography.body,
    color: Palette.ink,
    fontFamily: Fonts.sans,
    fontWeight: '700',
  },
  laterHint: {
    ...Typography.caption,
    textAlign: 'center',
    color: Palette.inkSoft,
    fontFamily: Fonts.sans,
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.96 }],
  },
});
