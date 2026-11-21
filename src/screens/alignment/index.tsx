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
  Animated,
  AppState,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Reanimated, {
  runOnJS,
  runOnUI,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconButton } from '@/components/icon-button';
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

const AnimatedArchiveImage = Animated.createAnimatedComponent(Image);

const MAX_CAMERA_ZOOM = 1;
// Bornes du pincement sur l'archive : assez pour rattraper un cadrage plus serré ou plus large
// qu'en 1970, sans perdre la photo hors du cadre.
const MIN_OVERLAY_SCALE = 0.5;
const MAX_OVERLAY_SCALE = 3;
const OVERLAY_SPRING = { damping: 18, stiffness: 220 };
// Largeur du panneau de contrôle quand le téléphone est à l'horizontale : le viseur garde le
// reste de la largeur pour cadrer les archives au format paysage.
const CONTROL_PANEL_LANDSCAPE_WIDTH = 296;

async function cropToAspectRatio(
  uri: string,
  width: number,
  height: number,
  targetAspectRatio: number,
) {
  const sourceAspectRatio = width / height;
  let cropWidth = width;
  let cropHeight = height;
  let originX = 0;
  let originY = 0;

  if (sourceAspectRatio > targetAspectRatio) {
    cropWidth = height * targetAspectRatio;
    originX = (width - cropWidth) / 2;
  } else {
    cropHeight = width / targetAspectRatio;
    originY = (height - cropHeight) / 2;
  }

  const context = ImageManipulator.manipulate(uri);
  context.crop({
    originX: Math.round(originX),
    originY: Math.round(originY),
    width: Math.round(cropWidth),
    height: Math.round(cropHeight),
  });
  const rendered = await context.renderAsync();
  return rendered.saveAsync({ compress: 0.96, format: SaveFormat.JPEG });
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
  const [hintDismissed, setHintDismissed] = useState(false);
  // Position et échelle de l'archive superposée, pilotées sur le thread UI par les gestes.
  const overlayX = useSharedValue(0);
  const overlayY = useSharedValue(0);
  const overlayZoom = useSharedValue(1);
  const panStart = useSharedValue({ x: 0, y: 0 });
  const zoomStart = useSharedValue(1);
  const [opacityResetKey, setOpacityResetKey] = useState(0);
  const [capturing, setCapturing] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraZoom, setCameraZoom] = useState(0);
  const [captureError, setCaptureError] = useState<string>();
  const [failedReferenceKey, setFailedReferenceKey] = useState<string>();
  const [loadedReferenceKey, setLoadedReferenceKey] = useState<string>();
  const [viewfinderSize, setViewfinderSize] = useState({ width: 0, height: 0 });
  const [overlayOpacity] = useState(() => new Animated.Value(0.52));
  const { lenses, selectedLens, setSelectedLens, onAvailableLensesChanged } =
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

  const backgroundImage = isSimulator ? SIMULATED_CAMERA_IMAGE : undefined;

  const topBarOffset = Math.max(insets.top, 52) + Spacing.one;
  const captureFrame = useMemo(() => {
    const horizontalPadding = Spacing.three;
    const availableTop = topBarOffset + 54;
    const availableBottom = Math.max(availableTop, viewfinderSize.height - 108);
    const maxWidth = Math.max(0, viewfinderSize.width - horizontalPadding * 2);
    const maxHeight = Math.max(0, availableBottom - availableTop - Spacing.two);

    if (!maxWidth || !maxHeight) {
      return { left: 0, top: 0, width: 0, height: 0 };
    }

    let width = maxWidth;
    let height = width / referenceAspectRatio;
    if (height > maxHeight) {
      height = maxHeight;
      width = height * referenceAspectRatio;
    }

    return {
      left: (viewfinderSize.width - width) / 2,
      top: availableTop + (maxHeight - height) / 2,
      width,
      height,
    };
  }, [
    referenceAspectRatio,
    topBarOffset,
    viewfinderSize.height,
    viewfinderSize.width,
  ]);

  // Un doigt déplace l'archive, deux doigts la zoomment : les deux gestes se combinent, comme
  // dans Photos.
  const dismissHint = useCallback(() => setHintDismissed(true), []);
  const selectionHaptic = useCallback(() => {
    dismissHint();
    void Haptics.selectionAsync();
  }, [dismissHint]);
  const pan = Gesture.Pan()
    .minDistance(3)
    .averageTouches(true)
    .onStart(() => {
      'worklet';
      panStart.value = { x: overlayX.value, y: overlayY.value };
    })
    .onUpdate((event) => {
      'worklet';
      overlayX.value = panStart.value.x + event.translationX;
      overlayY.value = panStart.value.y + event.translationY;
    })
    .onEnd(() => {
      'worklet';
      runOnJS(selectionHaptic)();
    });
  const pinch = Gesture.Pinch()
    .onStart(() => {
      'worklet';
      zoomStart.value = overlayZoom.value;
    })
    .onUpdate((event) => {
      'worklet';
      overlayZoom.value = Math.max(
        MIN_OVERLAY_SCALE,
        Math.min(MAX_OVERLAY_SCALE, zoomStart.value * event.scale),
      );
    })
    .onEnd(() => {
      'worklet';
      runOnJS(selectionHaptic)();
    });
  const overlayGesture = Gesture.Simultaneous(pan, pinch);
  const overlayTransformStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: overlayX.value },
      { translateY: overlayY.value },
      { scale: overlayZoom.value },
    ],
  }));

  const resetAlignment = () => {
    runOnUI(() => {
      'worklet';
      overlayX.value = withSpring(0, OVERLAY_SPRING);
      overlayY.value = withSpring(0, OVERLAY_SPRING);
      overlayZoom.value = withSpring(1, OVERLAY_SPRING);
    })();
    setCameraZoom(0);
    setOpacityResetKey((key) => key + 1);
    Animated.parallel([
      Animated.timing(overlayOpacity, {
        toValue: 0.52,
        duration: 160,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const capture = async () => {
    if (!referenceImage || referenceImageFailed) {
      setCaptureError(
        archiveImagesLoading
          ? 'La photo de 1970 se charge encore.'
          : 'La photo de 1970 est indisponible. Revenez au lieu puis réessayez.',
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
      const croppedResult = result
        ? await cropToAspectRatio(
            result.uri,
            result.width,
            result.height,
            referenceAspectRatio,
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

  const hintText =
    captureError ??
    (archiveImagesLoading
      ? 'Chargement de la photo de 1970…'
      : referenceImageFailed
        ? 'La photo de 1970 est indisponible. Revenez en arrière pour réessayer.'
        : !referenceImage
          ? 'Aucune photo de 1970 pour cette vue.'
          : isSimulator
            ? 'Scène d’essai : sur iPhone, la caméra la remplace.'
            : hintDismissed
              ? undefined
              : 'Glissez et pincez la photo de 1970 pour l’aligner.');

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
        <IconButton
          icon="xmark"
          variant="dark"
          accessibilityLabel="Fermer le viseur"
          onPress={() => router.back()}
        />
        <View style={styles.permissionCard}>
          {permissionLoading ? (
            <ActivityIndicator color={Palette.brass} size="large" />
          ) : (
            <SymbolView name="camera.fill" size={34} tintColor={Palette.brass} />
          )}
          <Text style={styles.permissionTitle}>
            {permissionLoading ? 'Ouverture de la caméra…' : 'Autorisez la caméra'}
          </Text>
          <Text style={styles.permissionCopy}>
            {permissionLoading
              ? 'Un instant.'
              : canAskAgain
                ? 'Paris GO en a besoin pour superposer la photo de 1970 et prendre la vôtre.'
                : 'L’accès est refusé. Autorisez la caméra dans les Réglages.'}
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

  return (
    <View style={[styles.screen, isLandscape && styles.screenLandscape]}>
      <View
        style={styles.viewfinder}
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
            source={backgroundImage}
            style={[
              StyleSheet.absoluteFill,
              { transform: [{ scale: 1 + cameraZoom * 1.8 }] },
            ]}
            contentFit="cover"
          />
        ) : null}

        <View style={styles.cameraWash} />
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
                {
                  top: captureFrame.top + captureFrame.height,
                  left: 0,
                  right: 0,
                  bottom: 0,
                },
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
                  right: 0,
                  top: captureFrame.top,
                  width: captureFrame.left,
                  height: captureFrame.height,
                },
              ]}
            />
            <View
              style={[
                styles.referenceFrame,
                {
                  left: captureFrame.left,
                  top: captureFrame.top,
                  width: captureFrame.width,
                  height: captureFrame.height,
                },
              ]}>
              {referenceImage ? (
                <Reanimated.View pointerEvents="none" style={[StyleSheet.absoluteFill, overlayTransformStyle]}>
                  <AnimatedArchiveImage
                    source={referenceImage}
                    onError={() => setFailedReferenceKey(referenceImageKey)}
                    onLoad={() => setLoadedReferenceKey(referenceImageKey)}
                    style={[StyleSheet.absoluteFill, { opacity: overlayOpacity }]}
                    contentFit="contain"
                  />
                </Reanimated.View>
              ) : null}
              {!referenceImageLoaded || referenceImageFailed ? (
                <View pointerEvents="none" style={styles.referenceStatus}>
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
                      ? 'PHOTO INDISPONIBLE'
                      : archiveImagesLoading || referenceImage
                        ? 'CHARGEMENT…'
                        : 'AUCUNE PHOTO DE 1970'}
                  </Text>
                </View>
              ) : null}
              <GestureDetector gesture={overlayGesture}>
                <View
                  accessibilityHint="Faites glisser pour déplacer la photo de 1970, pincez pour l’agrandir ou la réduire"
                  accessibilityLabel="Ajuster la photo de 1970"
                  style={styles.overlayGesture}
                />
              </GestureDetector>
              <View pointerEvents="none" style={styles.guides}>
                <View style={styles.horizontalGuide} />
                <View style={styles.verticalGuide} />
                <View style={[styles.corner, styles.cornerTopLeft]} />
                <View style={[styles.corner, styles.cornerTopRight]} />
                <View style={[styles.corner, styles.cornerBottomLeft]} />
                <View style={[styles.corner, styles.cornerBottomRight]} />
              </View>
            </View>
          </>
        ) : null}

        <View
          pointerEvents="box-none"
          style={[
            styles.topBar,
            {
              top: topBarOffset,
              // En paysage, le bord gauche du viseur peut être le vrai bord de l'écran (encoche
              // ou île dynamique selon le sens de rotation) : on respecte alors la zone sûre.
              left: isLandscape ? Math.max(Spacing.three, insets.left) : Spacing.three,
            },
          ]}>
          <IconButton
            icon="xmark"
            variant="dark"
            accessibilityLabel="Fermer le viseur"
            onPress={() => router.back()}
          />
          {isSimulator ? (
            <View style={styles.demoPill}>
              <Text style={styles.demoText}>MODE DÉMO</Text>
            </View>
          ) : null}
          <IconButton
            icon="arrow.counterclockwise"
            variant="dark"
            accessibilityLabel="Réinitialiser l’alignement"
            onPress={resetAlignment}
          />
        </View>
      </View>

      <SafeAreaView
        edges={isLandscape ? ['top', 'bottom', 'right'] : ['bottom']}
        style={[styles.controlPanel, isLandscape && styles.controlPanelLandscape]}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.controlPanelContent}>
          <View style={styles.sliderRow}>
            <SymbolView name="photo" size={16} tintColor={Palette.blueMist} />
            <Slider
              key={opacityResetKey}
              accessibilityLabel="Transparence de la photo de 1970"
              style={styles.slider}
              value={0.52}
              minimumValue={0.08}
              maximumValue={0.92}
              minimumTrackTintColor={Palette.brass}
              maximumTrackTintColor={Palette.inkSoft}
              thumbTintColor={Palette.white}
              onValueChange={(value) => {
                overlayOpacity.setValue(value);
              }}
              onSlidingComplete={() => {
                dismissHint();
                void Haptics.selectionAsync();
              }}
            />
            <SymbolView name="photo.fill" size={16} tintColor={Palette.white} />
          </View>

          <View style={[styles.zoomRow, isLandscape && styles.zoomRowLandscape]}>
            {lenses.length > 1 ? (
              <View style={styles.lensPicker}>
                {lenses.map((lens) => {
                  const active = lens.id === selectedLens;
                  return (
                    <Pressable
                      key={lens.id}
                      accessibilityLabel={`Objectif ${lens.label}`}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      onPress={() => {
                        if (active) return;
                        // Le zoom est relatif à l'objectif : le garder après une bascule donnerait
                        // un cadrage différent de celui annoncé par la pastille.
                        setCameraZoom(0);
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
            ) : (
              <Pressable
                accessibilityLabel="Zoom 1×"
                accessibilityRole="button"
                onPress={() => {
                  setCameraZoom(0);
                  void Haptics.selectionAsync();
                }}
                style={[styles.lensChip, cameraZoom === 0 && styles.lensChipActive]}>
                <Text style={[styles.lensChipText, cameraZoom === 0 && styles.lensChipTextActive]}>
                  1×
                </Text>
              </Pressable>
            )}
            <Slider
              accessibilityLabel="Zoom de la caméra"
              accessibilityValue={{
                min: 0,
                max: 100,
                now: Math.round(cameraZoom * 100),
              }}
              style={styles.slider}
              value={cameraZoom}
              minimumValue={0}
              maximumValue={MAX_CAMERA_ZOOM}
              step={0.01}
              minimumTrackTintColor={Palette.brass}
              maximumTrackTintColor={Palette.inkSoft}
              thumbTintColor={Palette.white}
              onValueChange={setCameraZoom}
              onSlidingComplete={() => void Haptics.selectionAsync()}
            />
          </View>

          <View style={styles.captureRow}>
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
              <View style={styles.shutterInner} />
            </Pressable>
          </View>

          {hintText ? (
            <Text accessibilityLiveRegion="polite" style={styles.captureHint}>
              {hintText}
            </Text>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  permissionScreen: {
    flex: 1,
    padding: Spacing.three,
    backgroundColor: Palette.black,
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
    backgroundColor: Palette.black,
  },
  screenLandscape: {
    flexDirection: 'row',
  },
  viewfinder: {
    flex: 1,
    minHeight: 420,
    overflow: 'hidden',
    backgroundColor: Palette.blueDeep,
  },
  cameraWash: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(8, 17, 22, 0.16)',
  },
  cropMask: {
    position: 'absolute',
    backgroundColor: 'rgba(8, 17, 22, 0.58)',
  },
  referenceFrame: {
    position: 'absolute',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.9)',
    backgroundColor: 'rgba(8, 17, 22, 0.12)',
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
  overlayGesture: {
    position: 'absolute',
    inset: 0,
  },
  guides: {
    position: 'absolute',
    inset: 0,
  },
  horizontalGuide: {
    position: 'absolute',
    left: '8%',
    right: '8%',
    top: '50%',
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.42)',
  },
  verticalGuide: {
    position: 'absolute',
    top: '17%',
    bottom: '17%',
    left: '50%',
    width: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.34)',
  },
  corner: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderColor: Palette.white,
  },
  cornerTopLeft: {
    left: -2,
    top: -2,
    borderLeftWidth: 2,
    borderTopWidth: 2,
  },
  cornerTopRight: {
    right: -2,
    top: -2,
    borderRightWidth: 2,
    borderTopWidth: 2,
  },
  cornerBottomLeft: {
    left: -2,
    bottom: -2,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
  },
  cornerBottomRight: {
    right: -2,
    bottom: -2,
    borderRightWidth: 2,
    borderBottomWidth: 2,
  },
  topBar: {
    position: 'absolute',
    left: Spacing.three,
    right: Spacing.three,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  demoPill: {
    minHeight: 34,
    paddingHorizontal: Spacing.twoHalf,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(8, 17, 22, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  demoText: {
    ...Typography.caption,
    color: Palette.brass,
    fontFamily: Fonts.display,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  controlPanel: {
    backgroundColor: Palette.black,
  },
  controlPanelLandscape: {
    width: CONTROL_PANEL_LANDSCAPE_WIDTH,
  },
  controlPanelContent: {
    paddingTop: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
    gap: Spacing.two,
  },
  sliderRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  slider: {
    flex: 1,
    height: 32,
  },
  zoomRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  zoomRowLandscape: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  lensPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    padding: 3,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  lensChip: {
    minWidth: 44,
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
    ...Typography.caption,
    color: Palette.white,
    fontFamily: Fonts.display,
    fontWeight: '800',
  },
  lensChipTextActive: {
    color: Palette.blueDeep,
  },
  captureRow: {
    minHeight: 84,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterOuter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: Palette.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Palette.white,
  },
  shutterPressed: {
    transform: [{ scale: 0.94 }],
  },
  shutterDisabled: {
    opacity: 0.48,
  },
  captureHint: {
    ...Typography.caption,
    color: Palette.blueMist,
    fontFamily: Fonts.sans,
    textAlign: 'center',
  },
  pressed: {
    transform: [{ scale: 0.94 }],
    opacity: 0.8,
  },
});
