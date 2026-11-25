import Slider from '@react-native-community/slider';
import * as Device from 'expo-device';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useIsFocused } from 'expo-router/react-navigation';
import * as ScreenOrientation from 'expo-screen-orientation';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Reanimated, {
  FadeIn,
  FadeOut,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Fonts, Palette, Radius, Spacing, Typography } from '@/constants/theme';
import { SIMULATED_CAMERA_IMAGE } from '@/constants/demo';

import { useBhvpImages } from '@/hooks/use-bhvp-images';
import { useCameraLenses } from '@/hooks/use-camera-lenses';
import { useImageAspectRatio } from '@/hooks/use-image-aspect-ratio';
import { useStationDetail } from '@/hooks/use-station-detail';
import { readGrantedCaptureLocation } from '@/services/capture-location';
import {
  historicalReferenceForFrame,
  referenceUriOf,
} from '@/services/camera-reference';
import { authorizeOfficialCapture } from '@/services/official-capture-authority';
import {
  fitAspectRatioInArea,
  photoCropForViewfinderFrame,
  type Rect,
} from '@/services/photo-geometry';

const MAX_CAMERA_ZOOM = 1;
// expo-camera applique `facteur = zoomMax ^ zoom`. Le zoom maximal de l'objectif n'est pas exposé
// en JavaScript : on suppose ×16, valeur courante sur iPhone, pour qu'un pincement ×2 donne à peu
// près un cadrage ×2.
const ZOOM_PINCH_BASE = 16;
// Deux doigts servent à la fois au zoom et au déplacement : le premier geste franc l'emporte
// jusqu'au lever des doigts, pour que zoomer ne décale pas l'archive (et inversement).
const MOVE_LOCK_DISTANCE = 12;
const ZOOM_LOCK_LOG_SCALE = 0.06;
const GESTURE_IDLE = 0;
const GESTURE_MOVE = 1;
const GESTURE_ZOOM = 2;

const DEFAULT_OPACITY = 0.52;
const MIN_OPACITY = 0.08;
const MAX_OPACITY = 0.92;
const GESTURE_HINT_DURATION_MS = 6000;
const OVERLAY_SPRING = { damping: 18, stiffness: 220 };

const BUTTON_SIZE = 44;
const SHUTTER_SIZE = 74;
// En portrait, hauteur du panneau bas avant sa première mesure.
const ESTIMATED_PANEL_HEIGHT = 150;
// En paysage, largeur de la colonne de droite (déclencheur, objectifs) hors zone sûre.
const LANDSCAPE_RIGHT_RAIL_WIDTH = 112;
const LANDSCAPE_SLIDER_LENGTH = 170;

async function cropPhoto(uri: string, crop: Rect) {
  const context = ImageManipulator.manipulate(uri);
  context.crop({
    originX: crop.left,
    originY: crop.top,
    width: crop.width,
    height: crop.height,
  });
  const rendered = await context.renderAsync();
  return rendered.saveAsync({ compress: 0.96, format: SaveFormat.JPEG });
}

function centeredCropForAspectRatio(width: number, height: number, aspectRatio: number): Rect {
  const crop = fitAspectRatioInArea({ left: 0, top: 0, width, height }, aspectRatio);
  return {
    left: Math.round(crop.left),
    top: Math.round(crop.top),
    width: Math.round(crop.width),
    height: Math.round(crop.height),
  };
}

export function AlignmentScreen() {
  const router = useRouter();
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();
  const cameraRef = useRef<CameraView>(null);
  const { id, frame } = useLocalSearchParams<{ id: string; frame?: string }>();
  const { detail } = useStationDetail(id);
  const [permission, requestPermission, refreshPermission] = useCameraPermissions({ get: false });
  const permissionRefreshInFlight = useRef(false);

  // Archive superposée et zoom caméra, pilotés sur le thread UI par les gestes à deux doigts.
  const overlayX = useSharedValue(0);
  const overlayY = useSharedValue(0);
  const moveStart = useSharedValue({ x: 0, y: 0 });
  const moveLockOffset = useSharedValue({ x: 0, y: 0 });
  const cameraZoomValue = useSharedValue(0);
  const zoomStart = useSharedValue(0);
  const zoomLockScale = useSharedValue(1);
  const gestureMode = useSharedValue(GESTURE_IDLE);
  const activeGestures = useSharedValue(0);
  const overlayOpacity = useSharedValue(DEFAULT_OPACITY);
  const overlayShown = useSharedValue(1);

  const [cameraZoom, setCameraZoom] = useState(0);
  const [opacityLabel, setOpacityLabel] = useState(DEFAULT_OPACITY);
  // Valeur de départ du slider : elle ne change qu'au relâcher ou à la réinitialisation, pour que
  // le slider garde la bonne position quand il est recréé à la rotation de l'écran.
  const [opacitySliderValue, setOpacitySliderValue] = useState(DEFAULT_OPACITY);
  const [opacityResetKey, setOpacityResetKey] = useState(0);
  const [archiveVisible, setArchiveVisible] = useState(true);
  const [gestureHintVisible, setGestureHintVisible] = useState(true);
  const [capturing, setCapturing] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [captureError, setCaptureError] = useState<string>();
  const [failedReferenceKey, setFailedReferenceKey] = useState<string>();
  const [loadedReferenceKey, setLoadedReferenceKey] = useState<string>();
  const [viewfinderSize, setViewfinderSize] = useState({ width: 0, height: 0 });
  const [panelHeight, setPanelHeight] = useState(ESTIMATED_PANEL_HEIGHT);
  const { lenses, selectedLens, setSelectedLens, activeLabel, onAvailableLensesChanged } =
    useCameraLenses(cameraRef, cameraReady);

  useEffect(() => {
    if (!Device.isDevice || !isFocused) return;

    let mounted = true;
    const refreshCameraPermission = () => {
      if (permissionRefreshInFlight.current) return;
      permissionRefreshInFlight.current = true;
      void refreshPermission()
        .catch(() => {
          if (mounted) {
            setCaptureError('La vérification de l’accès à la caméra a échoué. Réessayez.');
          }
        })
        .finally(() => {
          permissionRefreshInFlight.current = false;
        });
    };

    refreshCameraPermission();
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' && isFocused) refreshCameraPermission();
    });

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, [isFocused, refreshPermission]);

  // Beaucoup d'archives de 1970 sont au format paysage : le viseur doit pouvoir pivoter pour les
  // cadrer, alors que le reste de l'app n'est pas conçu pour et doit rester en portrait. Le
  // verrou n'est donc levé que pendant que cet écran a le focus, et reposé dès qu'on le quitte.
  useEffect(() => {
    if (!isFocused) return;
    // unlockAsync() rend la main aux capteurs (portrait et paysage) au lieu de figer un sens.
    ScreenOrientation.unlockAsync().catch(() => {});
    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
    };
  }, [isFocused]);

  // L'aide aux gestes s'efface d'elle-même, ou dès le premier geste reconnu.
  useEffect(() => {
    if (!gestureHintVisible) return;
    const timeout = setTimeout(() => setGestureHintVisible(false), GESTURE_HINT_DURATION_MS);
    return () => clearTimeout(timeout);
  }, [gestureHintVisible]);

  // Le zoom vit sur le thread UI pendant le pincement ; la caméra le reçoit par paliers fins pour
  // ne pas re-rendre l'écran à chaque image.
  useAnimatedReaction(
    () => Math.round(cameraZoomValue.value * 500) / 500,
    (next, previous) => {
      if (next !== previous) runOnJS(setCameraZoom)(next);
    },
  );

  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const isLandscape = windowWidth > windowHeight;

  const isSimulator = !Device.isDevice;
  const liveCamera = Device.isDevice && permission?.granted;
  const isArchiveSector = detail?.kind === 'archive-1970';
  const { images: archiveImages, loading: archiveImagesLoading } = useBhvpImages(
    isArchiveSector ? detail?.archiveLinks : undefined,
  );
  const requestedFrame = Number.parseInt(frame ?? '0', 10);
  const stationImages = useMemo(
    () => (archiveImages.length > 0 ? archiveImages : detail?.images ?? []),
    [archiveImages, detail?.images],
  );
  const { frameIndex, image: referenceImage } = historicalReferenceForFrame({
    images: stationImages,
    recaptureImage: detail?.recaptureImage,
    referenceImage: detail?.referenceImage,
    requestedFrame,
  });
  const referenceImageKey = JSON.stringify(referenceImage ?? null);
  const referenceImageFailed = failedReferenceKey === referenceImageKey;
  const referenceImageLoaded = loadedReferenceKey === referenceImageKey;
  const { aspectRatio: referenceAspectRatio } = useImageAspectRatio(referenceImage);

  // Zone libre pour le cadre : tout l'écran, moins la barre du haut et le panneau du bas en
  // portrait, ou les deux colonnes latérales en paysage.
  const leftRailWidth = Math.max(Spacing.three, insets.left) + BUTTON_SIZE + Spacing.three;
  const rightRailWidth = LANDSCAPE_RIGHT_RAIL_WIDTH + insets.right;
  const topBarTop = insets.top + Spacing.two;
  const frameArea = useMemo<Rect>(() => {
    const { width, height } = viewfinderSize;
    if (isLandscape) {
      const top = insets.top + Spacing.two;
      return {
        left: leftRailWidth,
        top,
        width: width - leftRailWidth - rightRailWidth,
        height: height - top - insets.bottom - Spacing.two,
      };
    }
    const top = topBarTop + BUTTON_SIZE + Spacing.two;
    return { left: 0, top, width, height: height - top - panelHeight };
  }, [
    insets.bottom,
    insets.top,
    isLandscape,
    leftRailWidth,
    panelHeight,
    rightRailWidth,
    topBarTop,
    viewfinderSize,
  ]);
  const captureFrame = useMemo(
    () => fitAspectRatioInArea(frameArea, referenceAspectRatio),
    [frameArea, referenceAspectRatio],
  );

  const hideGestureHint = useCallback(() => setGestureHintVisible(false), []);
  const selectionHaptic = useCallback(() => {
    void Haptics.selectionAsync();
  }, []);

  const lockGesture = (mode: number) => {
    'worklet';
    gestureMode.value = mode;
    runOnJS(selectionHaptic)();
    runOnJS(hideGestureHint)();
  };
  const beginGesture = () => {
    'worklet';
    activeGestures.value += 1;
  };
  const finalizeGesture = () => {
    'worklet';
    activeGestures.value = Math.max(0, activeGestures.value - 1);
    if (activeGestures.value === 0) gestureMode.value = GESTURE_IDLE;
  };

  // Deux doigts qui glissent ensemble déplacent l'archive.
  const move = Gesture.Pan()
    .minPointers(2)
    .maxPointers(2)
    .averageTouches(true)
    .onBegin(beginGesture)
    .onStart(() => {
      'worklet';
      moveStart.value = { x: overlayX.value, y: overlayY.value };
    })
    .onUpdate((event) => {
      'worklet';
      if (gestureMode.value === GESTURE_IDLE) {
        if (Math.hypot(event.translationX, event.translationY) < MOVE_LOCK_DISTANCE) return;
        moveLockOffset.value = { x: event.translationX, y: event.translationY };
        lockGesture(GESTURE_MOVE);
      }
      if (gestureMode.value !== GESTURE_MOVE) return;
      overlayX.value = moveStart.value.x + event.translationX - moveLockOffset.value.x;
      overlayY.value = moveStart.value.y + event.translationY - moveLockOffset.value.y;
    })
    .onFinalize(finalizeGesture);

  // Deux doigts qui s'écartent zooment la caméra, comme dans l'app Appareil photo.
  const zoom = Gesture.Pinch()
    .onBegin(beginGesture)
    .onStart(() => {
      'worklet';
      zoomStart.value = cameraZoomValue.value;
    })
    .onUpdate((event) => {
      'worklet';
      if (gestureMode.value === GESTURE_IDLE) {
        if (Math.abs(Math.log(event.scale)) < ZOOM_LOCK_LOG_SCALE) return;
        zoomLockScale.value = event.scale;
        lockGesture(GESTURE_ZOOM);
      }
      if (gestureMode.value !== GESTURE_ZOOM) return;
      const delta = Math.log(event.scale / zoomLockScale.value) / Math.log(ZOOM_PINCH_BASE);
      cameraZoomValue.value = Math.max(0, Math.min(MAX_CAMERA_ZOOM, zoomStart.value + delta));
    })
    .onFinalize(finalizeGesture);

  const viewfinderGesture = Gesture.Simultaneous(move, zoom);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value * overlayShown.value,
    transform: [{ translateX: overlayX.value }, { translateY: overlayY.value }],
  }));

  const setArchiveShown = (shown: boolean) => {
    setArchiveVisible(shown);
    overlayShown.set(withTiming(shown ? 1 : 0, { duration: 160 }));
  };

  const resetCameraZoom = () => {
    cameraZoomValue.set(0);
    setCameraZoom(0);
  };

  const resetAlignment = () => {
    overlayX.set(withSpring(0, OVERLAY_SPRING));
    overlayY.set(withSpring(0, OVERLAY_SPRING));
    overlayOpacity.set(withTiming(DEFAULT_OPACITY, { duration: 160 }));
    resetCameraZoom();
    setArchiveShown(true);
    setOpacityLabel(DEFAULT_OPACITY);
    setOpacitySliderValue(DEFAULT_OPACITY);
    setOpacityResetKey((key) => key + 1);
    void Haptics.selectionAsync();
  };

  const capture = async () => {
    if (!referenceImage || referenceImageFailed) {
      setCaptureError(
        archiveImagesLoading
          ? 'La photographie historique se charge encore.'
          : 'La photographie historique est indisponible. Revenez au secteur puis réessayez.',
      );
      return;
    }
    if (Device.isDevice && !liveCamera) {
      setCaptureError('Autorisez la caméra avant de prendre une photo.');
      return;
    }
    if (liveCamera && !cameraReady) {
      setCaptureError('La caméra se prépare encore. Réessayez dans un instant.');
      return;
    }

    setCapturing(true);
    setCaptureError(undefined);
    try {
      const locationPromise = liveCamera
        ? readGrantedCaptureLocation()
        : Promise.resolve(undefined);
      const result = liveCamera
        // Pas d'EXIF : le recadrage ré-encode et le supprime, mais le repli sur le JPEG brut
        // enverrait les coordonnées GPS au formulaire de l'Observatoire. Rien ne lit ces données.
        ? await cameraRef.current?.takePictureAsync({ quality: 1, exif: false })
        : undefined;
      // On garde exactement ce que montrait le cadre, et non le centre du capteur.
      const croppedResult = result
        ? await cropPhoto(
            result.uri,
            photoCropForViewfinderFrame({
              photoWidth: result.width,
              photoHeight: result.height,
              viewWidth: viewfinderSize.width,
              viewHeight: viewfinderSize.height,
              frame: captureFrame,
            }) ?? centeredCropForAspectRatio(result.width, result.height, referenceAspectRatio),
          )
        : undefined;
      const captureLocation = await locationPromise;
      const captureUri = croppedResult?.uri ?? result?.uri ?? '';
      if (liveCamera && captureUri) authorizeOfficialCapture(id ?? '', captureUri);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.push({
        pathname: '/capture-review',
        params: {
          id: id ?? '',
          frame: String(frameIndex),
          referenceUri: referenceUriOf(referenceImage) ?? '',
          uri: captureUri,
          simulated: liveCamera ? '0' : '1',
          latitude: captureLocation ? String(captureLocation.latitude) : '',
          longitude: captureLocation ? String(captureLocation.longitude) : '',
          locationPrecision: captureLocation?.precision ?? '',
        },
      });
    } catch {
      setCaptureError('La photo a échoué. Gardez le viseur ouvert et réessayez.');
    } finally {
      setCapturing(false);
    }
  };

  const shutterDisabled =
    capturing ||
    !referenceImage ||
    referenceImageFailed ||
    (Device.isDevice && !liveCamera) ||
    (liveCamera && !cameraReady);

  if (Device.isDevice && !permission?.granted) {
    const permissionLoading = permission === null;
    const canAskAgain = permission?.canAskAgain !== false;
    return (
      <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={styles.permissionScreen}>
        <Pressable
          accessibilityLabel="Fermer le viseur"
          onPress={() => router.back()}
          style={({ pressed }) => [styles.permissionClose, pressed && styles.pressed]}>
          <SymbolView name="xmark" size={18} tintColor={Palette.white} />
        </Pressable>
        <View style={styles.permissionCard}>
          {permissionLoading ? (
            <ActivityIndicator color={Palette.brass} size="large" />
          ) : (
            <SymbolView name="camera.fill" size={34} tintColor={Palette.brass} />
          )}
          <Text style={styles.permissionTitle}>
            {permissionLoading ? 'Préparation de la caméra…' : 'Accès à la caméra requis'}
          </Text>
          <Text style={styles.permissionCopy}>
            {permissionLoading
              ? 'Paris GO vérifie l’autorisation avant d’ouvrir le viseur.'
              : canAskAgain
                ? 'Autorisez Paris GO à utiliser la caméra pour afficher le vrai viseur et prendre votre photo.'
                : 'L’accès à la caméra est refusé. Ouvrez les Réglages iOS et autorisez la caméra pour Paris GO.'}
          </Text>
          {!permissionLoading ? (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: permissionLoading }}
              onPress={() => {
                setCaptureError(undefined);
                if (canAskAgain) {
                  void requestPermission().catch(() => {
                    setCaptureError('La demande d’accès à la caméra a échoué. Réessayez.');
                  });
                } else {
                  void Linking.openSettings().catch(() => {
                    setCaptureError('Les Réglages ne peuvent pas être ouverts automatiquement.');
                  });
                }
              }}
              style={({ pressed }) => [styles.permissionButton, pressed && styles.pressed]}>
              <Text style={styles.permissionButtonText}>
                {canAskAgain ? 'Autoriser la caméra' : 'Ouvrir les Réglages'}
              </Text>
            </Pressable>
          ) : null}
          {captureError ? (
            <Text accessibilityLiveRegion="polite" style={styles.permissionError}>
              {captureError}
            </Text>
          ) : null}
        </View>
      </SafeAreaView>
    );
  }

  const photoTitle = `Photo ${String(frameIndex + 1).padStart(2, '0')} · ${detail?.year ?? 1970}`;
  const zoomPercent = Math.round(cameraZoom * 100);
  const statusMessage =
    captureError ??
    (archiveImagesLoading
      ? 'Chargement de la photographie historique depuis la BHVP…'
      : referenceImageFailed
        ? 'L’aperçu BHVP est momentanément indisponible. Revenez en arrière pour réessayer.'
        : !referenceImage
          ? 'Aucune photographie historique n’est disponible pour cette vue.'
          : undefined);
  const hintMessage =
    statusMessage ??
    (gestureHintVisible
      ? `${isSimulator ? 'Mode démo · ' : ''}Pincez pour zoomer, glissez à deux doigts pour placer l’archive. Restez sur le domaine public.`
      : undefined);

  const closeButton = (
    <Pressable
      accessibilityLabel="Fermer le viseur"
      onPress={() => router.back()}
      style={({ pressed }) => [styles.roundButton, pressed && styles.pressed]}>
      <SymbolView name="xmark" size={18} tintColor={Palette.white} />
    </Pressable>
  );
  const resetButton = (
    <Pressable
      accessibilityLabel="Réinitialiser l’alignement"
      onPress={resetAlignment}
      style={({ pressed }) => [styles.roundButton, pressed && styles.pressed]}>
      <SymbolView name="arrow.counterclockwise" size={18} tintColor={Palette.white} />
    </Pressable>
  );
  const archiveToggle = (
    <Pressable
      accessibilityLabel={archiveVisible ? 'Masquer l’archive' : 'Afficher l’archive'}
      accessibilityRole="button"
      accessibilityState={{ selected: archiveVisible }}
      onPress={() => {
        setArchiveShown(!archiveVisible);
        void Haptics.selectionAsync();
      }}
      style={({ pressed }) => [
        styles.roundButton,
        !archiveVisible && styles.roundButtonActive,
        pressed && styles.pressed,
      ]}>
      <SymbolView
        name={archiveVisible ? 'eye' : 'eye.slash'}
        size={18}
        tintColor={archiveVisible ? Palette.white : Palette.blueDeep}
      />
    </Pressable>
  );
  const shutter = (
    <Pressable
      accessibilityLabel={liveCamera ? 'Prendre la photo' : 'Simuler la photo'}
      accessibilityRole="button"
      accessibilityState={{ disabled: shutterDisabled }}
      disabled={shutterDisabled}
      onPress={capture}
      style={({ pressed }) => [
        styles.shutterOuter,
        pressed && styles.shutterPressed,
        shutterDisabled && styles.shutterDisabled,
      ]}>
      {capturing ? (
        <ActivityIndicator color={Palette.blueDeep} style={styles.shutterInner} />
      ) : (
        <View style={styles.shutterInner} />
      )}
    </Pressable>
  );
  // Sur un appareil à un seul objectif, la pastille 1× sert seulement à annuler le zoom.
  const lensOptions =
    lenses.length > 1 ? lenses : [{ id: selectedLens, label: activeLabel, order: 0 }];
  const lensPicker = (
    <View style={[styles.lensPicker, isLandscape && styles.lensPickerVertical]}>
      {lensOptions.map((lens) => {
        const active = lens.id === selectedLens;
        return (
          <Pressable
            key={lens.id}
            accessibilityLabel={
              active && zoomPercent > 0
                ? `Objectif ${lens.label}, zoom ${zoomPercent} %, toucher pour annuler le zoom`
                : `Objectif ${lens.label}`
            }
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => {
              if (active) {
                if (cameraZoomValue.get() > 0) {
                  resetCameraZoom();
                  void Haptics.selectionAsync();
                }
                return;
              }
              // Le zoom est relatif à l'objectif : le garder après une bascule donnerait un
              // cadrage différent de celui annoncé par la pastille.
              resetCameraZoom();
              setSelectedLens(lens.id);
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid);
            }}
            style={[styles.lensChip, active && styles.lensChipActive]}>
            <Text style={[styles.lensChipText, active && styles.lensChipTextActive]}>
              {lens.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
  const updateOpacity = (value: number) => {
    overlayOpacity.set(value);
    setOpacityLabel(value);
    if (!archiveVisible) setArchiveShown(true);
  };
  const opacitySlider = (
    <Slider
      key={opacityResetKey}
      accessibilityLabel="Transparence de l’archive"
      style={isLandscape ? styles.opacitySliderVertical : styles.opacitySlider}
      value={opacitySliderValue}
      minimumValue={MIN_OPACITY}
      maximumValue={MAX_OPACITY}
      minimumTrackTintColor={Palette.brass}
      maximumTrackTintColor="rgba(255, 255, 255, 0.28)"
      thumbTintColor={Palette.white}
      onValueChange={updateOpacity}
      onSlidingComplete={(value) => {
        setOpacitySliderValue(value);
        void Haptics.selectionAsync();
      }}
    />
  );
  const opacityValue = (
    <Text style={styles.opacityValue}>{Math.round(opacityLabel * 100)}%</Text>
  );

  return (
    <View
      style={styles.screen}
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        setViewfinderSize({ width, height });
      }}>
      {liveCamera ? (
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing="back"
          mode="picture"
          active={isFocused}
          zoom={cameraZoom}
          selectedLens={selectedLens}
          onAvailableLensesChanged={({ lenses: available }) => onAvailableLensesChanged(available)}
          onCameraReady={() => setCameraReady(true)}
          onMountError={() => {
            setCameraReady(false);
            setCaptureError('La caméra ne peut pas démarrer. Fermez le viseur puis réessayez.');
          }}
        />
      ) : isSimulator ? (
        <Image
          source={SIMULATED_CAMERA_IMAGE}
          style={[
            StyleSheet.absoluteFill,
            { transform: [{ scale: Math.pow(ZOOM_PINCH_BASE, cameraZoom) }] },
          ]}
          contentFit="cover"
        />
      ) : null}

      {captureFrame.width ? (
        <>
          <View
            pointerEvents="none"
            style={[styles.cropMask, { height: captureFrame.top, left: 0, right: 0, top: 0 }]}
          />
          <View
            pointerEvents="none"
            style={[
              styles.cropMask,
              { top: captureFrame.top + captureFrame.height, left: 0, right: 0, bottom: 0 },
            ]}
          />
          <View
            pointerEvents="none"
            style={[
              styles.cropMask,
              {
                left: 0,
                top: captureFrame.top,
                width: captureFrame.left,
                height: captureFrame.height,
              },
            ]}
          />
          <View
            pointerEvents="none"
            style={[
              styles.cropMask,
              {
                left: captureFrame.left + captureFrame.width,
                right: 0,
                top: captureFrame.top,
                height: captureFrame.height,
              },
            ]}
          />
          <View pointerEvents="none" style={[styles.referenceFrame, captureFrame]}>
            {referenceImage ? (
              <Reanimated.View style={[StyleSheet.absoluteFill, overlayStyle]}>
                <Image
                  source={referenceImage}
                  onError={() => setFailedReferenceKey(referenceImageKey)}
                  onLoad={() => setLoadedReferenceKey(referenceImageKey)}
                  style={StyleSheet.absoluteFill}
                  contentFit="contain"
                />
              </Reanimated.View>
            ) : null}
            {!referenceImageLoaded || referenceImageFailed ? (
              <View style={styles.referenceStatus}>
                {!referenceImageFailed && (archiveImagesLoading || referenceImage) ? (
                  <ActivityIndicator color={Palette.white} />
                ) : (
                  <SymbolView
                    name="photo.badge.exclamationmark"
                    size={24}
                    tintColor={Palette.brass}
                  />
                )}
                <Text style={styles.referenceStatusText}>
                  {referenceImageFailed
                    ? 'APERÇU INDISPONIBLE'
                    : archiveImagesLoading || referenceImage
                      ? 'CHARGEMENT DE L’ARCHIVE…'
                      : 'AUCUNE ARCHIVE À SUPERPOSER'}
                </Text>
              </View>
            ) : null}
            <View style={styles.horizontalGuide} />
            <View style={styles.verticalGuide} />
            <View style={[styles.corner, styles.cornerTopLeft]} />
            <View style={[styles.corner, styles.cornerTopRight]} />
            <View style={[styles.corner, styles.cornerBottomLeft]} />
            <View style={[styles.corner, styles.cornerBottomRight]} />
          </View>
        </>
      ) : null}

      {/* Toute la surface du viseur reçoit les gestes, pas seulement le cadre. */}
      <GestureDetector gesture={viewfinderGesture}>
        <View
          accessibilityHint="Pincez pour zoomer la caméra, glissez à deux doigts pour déplacer l’archive"
          accessibilityLabel="Viseur"
          style={StyleSheet.absoluteFill}
        />
      </GestureDetector>

      <View
        pointerEvents="box-none"
        style={[
          styles.floatingStack,
          {
            left: frameArea.left + Spacing.three,
            width: Math.max(0, frameArea.width - Spacing.three * 2),
            bottom: isLandscape ? insets.bottom + Spacing.three : panelHeight + Spacing.two,
          },
        ]}>
        {zoomPercent > 0 ? (
          <Reanimated.View entering={FadeIn.duration(120)} exiting={FadeOut.duration(160)}>
            <Pressable
              accessibilityLabel={`Zoom ${zoomPercent} %, toucher pour annuler`}
              accessibilityRole="button"
              onPress={() => {
                resetCameraZoom();
                void Haptics.selectionAsync();
              }}
              style={({ pressed }) => [styles.zoomPill, pressed && styles.pressed]}>
              <Text style={styles.zoomPillText}>
                {activeLabel} · ZOOM +{zoomPercent}%
              </Text>
            </Pressable>
          </Reanimated.View>
        ) : null}
        {hintMessage ? (
          <Reanimated.View
            key={hintMessage}
            entering={FadeIn.duration(160)}
            exiting={FadeOut.duration(220)}
            pointerEvents="none"
            style={[styles.hintPill, statusMessage && styles.hintPillStatus]}>
            <Text accessibilityLiveRegion="polite" style={styles.hintText}>
              {hintMessage}
            </Text>
          </Reanimated.View>
        ) : null}
      </View>

      {isLandscape ? (
        <>
          <View
            pointerEvents="box-none"
            style={[
              styles.leftRail,
              {
                width: leftRailWidth,
                paddingLeft: Math.max(Spacing.three, insets.left),
                paddingTop: insets.top + Spacing.three,
                paddingBottom: insets.bottom + Spacing.three,
              },
            ]}>
            {closeButton}
            <View style={styles.verticalSliderSlot}>
              {opacitySlider}
              {opacityValue}
            </View>
            {resetButton}
          </View>
          <View
            pointerEvents="box-none"
            style={[
              styles.rightRail,
              {
                width: rightRailWidth,
                paddingRight: insets.right,
                paddingTop: insets.top + Spacing.three,
                paddingBottom: insets.bottom + Spacing.three,
              },
            ]}>
            <Text numberOfLines={2} style={styles.railTitle}>
              {photoTitle}
              {isSimulator ? '\nDÉMO' : ''}
            </Text>
            <View style={styles.rightRailControls}>
              {archiveToggle}
              {shutter}
              {lensPicker}
            </View>
          </View>
        </>
      ) : (
        <>
          <View pointerEvents="box-none" style={[styles.topBar, { top: topBarTop }]}>
            {closeButton}
            <View style={styles.titlePill}>
              <View
                style={[
                  styles.titleDot,
                  { backgroundColor: isSimulator ? Palette.brass : Palette.lichen },
                ]}
              />
              <Text numberOfLines={1} style={styles.titleText}>
                {photoTitle}
                {isSimulator ? ' · DÉMO' : ''}
              </Text>
            </View>
            {resetButton}
          </View>
          <View
            pointerEvents="box-none"
            onLayout={(event) => setPanelHeight(event.nativeEvent.layout.height)}
            style={[styles.bottomPanel, { paddingBottom: Math.max(insets.bottom, Spacing.three) }]}>
            <View style={styles.opacityRow}>
              <SymbolView name="photo" size={16} tintColor={Palette.blueMist} />
              {opacitySlider}
              {opacityValue}
            </View>
            <View style={styles.captureRow}>
              <View style={styles.captureSide}>{lensPicker}</View>
              {shutter}
              <View style={[styles.captureSide, styles.captureSideEnd]}>{archiveToggle}</View>
            </View>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  permissionScreen: {
    flex: 1,
    padding: Spacing.three,
    backgroundColor: Palette.black,
  },
  permissionClose: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Palette.inkSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  permissionCard: {
    flex: 1,
    maxWidth: 420,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },
  permissionTitle: {
    ...Typography.display,
    marginTop: Spacing.three,
    color: Palette.white,
    fontFamily: Fonts.display,
    textAlign: 'center',
  },
  permissionCopy: {
    ...Typography.body,
    marginTop: Spacing.two,
    color: Palette.blueMist,
    fontFamily: Fonts.sans,
    textAlign: 'center',
  },
  permissionButton: {
    minHeight: 50,
    marginTop: Spacing.four,
    paddingHorizontal: Spacing.four,
    borderRadius: Radius.pill,
    backgroundColor: Palette.brass,
    alignItems: 'center',
    justifyContent: 'center',
  },
  permissionButtonText: {
    ...Typography.body,
    color: Palette.blueDeep,
    fontFamily: Fonts.sans,
    fontWeight: '800',
  },
  permissionError: {
    ...Typography.caption,
    marginTop: Spacing.two,
    color: Palette.brass,
    fontFamily: Fonts.sans,
    textAlign: 'center',
  },
  screen: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: Palette.black,
  },
  cropMask: {
    position: 'absolute',
    backgroundColor: 'rgba(8, 17, 22, 0.62)',
  },
  referenceFrame: {
    position: 'absolute',
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.7)',
  },
  referenceStatus: {
    position: 'absolute',
    inset: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    backgroundColor: 'rgba(8, 17, 22, 0.54)',
  },
  referenceStatusText: {
    ...Typography.caption,
    color: Palette.white,
    fontFamily: Fonts.display,
    fontWeight: '900',
    letterSpacing: 0.4,
    textAlign: 'center',
  },
  horizontalGuide: {
    position: 'absolute',
    left: '8%',
    right: '8%',
    top: '50%',
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255, 255, 255, 0.36)',
  },
  verticalGuide: {
    position: 'absolute',
    top: '12%',
    bottom: '12%',
    left: '50%',
    width: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255, 255, 255, 0.28)',
  },
  corner: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderColor: Palette.white,
  },
  cornerTopLeft: {
    left: 0,
    top: 0,
    borderLeftWidth: 2,
    borderTopWidth: 2,
  },
  cornerTopRight: {
    right: 0,
    top: 0,
    borderRightWidth: 2,
    borderTopWidth: 2,
  },
  cornerBottomLeft: {
    left: 0,
    bottom: 0,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
  },
  cornerBottomRight: {
    right: 0,
    bottom: 0,
    borderRightWidth: 2,
    borderBottomWidth: 2,
  },
  floatingStack: {
    position: 'absolute',
    alignItems: 'center',
    gap: Spacing.two,
  },
  zoomPill: {
    minHeight: 32,
    paddingHorizontal: Spacing.twoHalf,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(8, 17, 22, 0.78)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomPillText: {
    ...Typography.caption,
    color: Palette.brass,
    fontFamily: Fonts.display,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  hintPill: {
    maxWidth: 420,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.medium,
    backgroundColor: 'rgba(8, 17, 22, 0.72)',
  },
  hintPillStatus: {
    backgroundColor: 'rgba(8, 17, 22, 0.88)',
  },
  hintText: {
    ...Typography.caption,
    color: Palette.white,
    fontFamily: Fonts.sans,
    textAlign: 'center',
  },
  topBar: {
    position: 'absolute',
    left: Spacing.three,
    right: Spacing.three,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
  },
  roundButton: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    backgroundColor: 'rgba(8, 17, 22, 0.68)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundButtonActive: {
    backgroundColor: Palette.brass,
  },
  titlePill: {
    flexShrink: 1,
    minHeight: 34,
    paddingHorizontal: Spacing.twoHalf,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(8, 17, 22, 0.72)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  titleDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  titleText: {
    ...Typography.caption,
    color: Palette.white,
    fontFamily: Fonts.display,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  bottomPanel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: Spacing.two,
    paddingHorizontal: Spacing.three,
    gap: Spacing.two,
  },
  opacityRow: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  opacitySlider: {
    flex: 1,
    height: 36,
  },
  opacityValue: {
    width: 42,
    color: Palette.white,
    fontFamily: Fonts.display,
    fontSize: Typography.caption.fontSize,
    fontWeight: '700',
    textAlign: 'right',
  },
  captureRow: {
    minHeight: SHUTTER_SIZE + Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
  },
  captureSide: {
    flex: 1,
    alignItems: 'flex-start',
  },
  captureSideEnd: {
    alignItems: 'flex-end',
  },
  leftRail: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'space-between',
  },
  verticalSliderSlot: {
    width: BUTTON_SIZE,
    alignItems: 'center',
    gap: Spacing.two,
  },
  opacitySliderVertical: {
    width: LANDSCAPE_SLIDER_LENGTH,
    height: BUTTON_SIZE,
    marginVertical: (LANDSCAPE_SLIDER_LENGTH - BUTTON_SIZE) / 2,
    transform: [{ rotate: '-90deg' }],
  },
  rightRail: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
  },
  railTitle: {
    ...Typography.caption,
    color: Palette.white,
    fontFamily: Fonts.display,
    fontWeight: '800',
    letterSpacing: 0.4,
    textAlign: 'center',
  },
  rightRailControls: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.four,
  },
  shutterOuter: {
    width: SHUTTER_SIZE,
    height: SHUTTER_SIZE,
    borderRadius: SHUTTER_SIZE / 2,
    borderWidth: 3,
    borderColor: Palette.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: {
    width: SHUTTER_SIZE - 14,
    height: SHUTTER_SIZE - 14,
    borderRadius: (SHUTTER_SIZE - 14) / 2,
    backgroundColor: Palette.white,
  },
  shutterPressed: {
    transform: [{ scale: 0.94 }],
  },
  shutterDisabled: {
    opacity: 0.48,
  },
  lensPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    padding: 3,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(8, 17, 22, 0.68)',
  },
  lensPickerVertical: {
    flexDirection: 'column',
  },
  lensChip: {
    minWidth: 40,
    height: 38,
    paddingHorizontal: Spacing.two,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lensChipActive: {
    backgroundColor: Palette.brass,
  },
  lensChipText: {
    color: Palette.white,
    fontFamily: Fonts.display,
    fontSize: Typography.caption.fontSize,
    fontWeight: '800',
  },
  lensChipTextActive: {
    color: Palette.blueDeep,
  },
  pressed: {
    transform: [{ scale: 0.94 }],
    opacity: 0.8,
  },
});
