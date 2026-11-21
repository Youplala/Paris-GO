import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IconButton } from '@/components/icon-button';
import { PrimaryButton } from '@/components/primary-button';
import {
  Fonts,
  Kicker,
  Palette,
  Radius,
  Shadow,
  Spacing,
  TabBarClearance,
  Typography,
} from '@/constants/theme';
import { deleteCapture, getSavedCaptures, type SavedCapture } from '@/services/fieldbook';
import { getFieldbookViewState } from '@/services/fieldbook-view-state';
import { setToSendCount } from '@/services/my-photos-count';

function formatDate(value: string) {
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(new Date(value));
}

/** Écran de l'onglet « Mes photos » : ce qu'il reste à envoyer, puis ce qui est parti. */
export function FieldbookScreen() {
  const router = useRouter();
  const [captures, setCaptures] = useState<SavedCapture[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  const load = useCallback(async () => {
    setError(undefined);
    try {
      setCaptures(await getSavedCaptures());
    } catch {
      setError('Vos photos n’ont pas pu être ouvertes. Réessayez.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Chaque retour sur l'onglet relit les photos : un envoi vient peut-être d'avoir lieu.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  useEffect(() => {
    if (!loading && !error) setToSendCount(captures.filter((capture) => !capture.submittedAt).length);
  }, [captures, loading, error]);

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
        dialogTitle: 'Partager cette photo',
        mimeType: 'image/jpeg',
        UTI: 'public.jpeg',
      });
      return;
    }
    await Share.share({
      message: `Ma photo de ${capture.stationName ?? 'Paris'} avec Paris GO.`,
    });
  };

  const confirmDelete = (capture: SavedCapture) => {
    Alert.alert(
      'Supprimer cette photo ?',
      'Elle sera supprimée de Paris GO. La copie éventuellement enregistrée dans Photos restera intacte.',
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

  const renderCard = (capture: SavedCapture, action?: 'primary' | 'secondary') => (
    <View key={capture.id} style={styles.card}>
      <View>
        {capture.imageUri ? (
          <Image
            source={{ uri: capture.imageUri }}
            contentFit="cover"
            accessibilityLabel={`Votre photo de ${capture.stationName ?? 'Paris'}`}
            style={styles.thumbnail}
          />
        ) : (
          <View style={[styles.thumbnail, styles.simulatedThumbnail]}>
            <SymbolView name="iphone.gen3" size={28} tintColor={Palette.parisBlue} />
            <Text style={styles.simulatedLabel}>MODE DÉMO</Text>
          </View>
        )}
        <IconButton
          icon="trash"
          variant="dark"
          accessibilityLabel="Supprimer cette photo"
          onPress={() => confirmDelete(capture)}
          style={styles.delete}
        />
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={2}>
          {capture.stationName ?? 'Photo sans titre'}
        </Text>
        <Text style={styles.cardMeta} numberOfLines={2}>
          {[formatDate(capture.createdAt), capture.stationAddress].filter(Boolean).join(' · ')}
        </Text>
        {capture.submittedAt ? (
          <View style={styles.statusRow}>
            <SymbolView name="checkmark.circle.fill" size={14} tintColor={Palette.lichen} />
            <Text style={styles.cardMeta}>En attente de validation par l’Observatoire</Text>
          </View>
        ) : null}
        <View style={styles.actions}>
          {action ? (
            <PrimaryButton
              label="Envoyer"
              icon="paperplane.fill"
              variant={action}
              onPress={() => resumeSubmission(capture)}
              style={styles.send}
            />
          ) : null}
          <IconButton
            icon="rectangle.split.2x1"
            label="Comparer"
            accessibilityLabel="Comparer avec la photo de 1970"
            onPress={() => compare(capture)}
            style={styles.tool}
          />
          <IconButton
            icon="square.and.arrow.up"
            accessibilityLabel="Partager cette photo"
            onPress={() => void share(capture)}
            style={styles.tool}
          />
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.screen}>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Palette.parisBlue} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <SymbolView name="exclamationmark.triangle.fill" size={30} tintColor={Palette.copper} />
          <Text style={styles.emptyCopy}>{error}</Text>
          <PrimaryButton label="Réessayer" onPress={() => void load()} style={styles.cta} />
        </View>
      ) : state.kind === 'empty' ? (
        <SafeAreaView edges={['top']} style={styles.center}>
          <View style={styles.emptyIcon}>
            <SymbolView name="camera.fill" size={31} tintColor={Palette.go} />
          </View>
          <Text accessibilityRole="header" style={styles.emptyTitle}>{state.title}</Text>
          <Text style={styles.emptyCopy}>{state.description}</Text>
          <PrimaryButton
            label="Refaire une première photo"
            icon="arrow.right"
            onPress={() => router.navigate('/')}
            style={styles.cta}
          />
        </SafeAreaView>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
          <SafeAreaView edges={['top']}>
            <Text accessibilityRole="header" style={styles.title}>Mes photos</Text>
          </SafeAreaView>

          {state.toSend.length > 0 ? (
            <View style={styles.section}>
              <Text accessibilityRole="header" style={styles.sectionTitle}>
                À envoyer · {state.toSend.length}
              </Text>
              {state.toSend.map((capture, index) =>
                renderCard(capture, index === 0 ? 'primary' : 'secondary'),
              )}
            </View>
          ) : null}

          {state.sent.length > 0 ? (
            <View style={styles.section}>
              <Text accessibilityRole="header" style={styles.sectionTitle}>
                Envoyées · {state.sent.length}
              </Text>
              {state.sent.map((capture) => renderCard(capture))}
            </View>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Palette.fog },
  center: {
    flex: 1,
    padding: Spacing.four,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
  },
  title: {
    ...Typography.display,
    paddingTop: Spacing.three,
    color: Palette.ink,
    fontFamily: Fonts.display,
    fontWeight: '800',
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Palette.goSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    ...Typography.display,
    textAlign: 'center',
    color: Palette.ink,
    fontFamily: Fonts.display,
    fontWeight: '800',
  },
  emptyCopy: {
    ...Typography.body,
    maxWidth: 300,
    textAlign: 'center',
    color: Palette.inkSoft,
    fontFamily: Fonts.sans,
  },
  cta: { alignSelf: 'stretch', marginTop: Spacing.two },
  list: { paddingHorizontal: Spacing.three, paddingBottom: TabBarClearance },
  section: { marginTop: Spacing.four, gap: Spacing.three },
  sectionTitle: { ...Kicker, color: Palette.inkSoft },
  card: {
    borderRadius: Radius.large,
    backgroundColor: Palette.white,
    overflow: 'hidden',
    ...Shadow.card,
  },
  thumbnail: { width: '100%', aspectRatio: 4 / 3, backgroundColor: Palette.blueMist },
  simulatedThumbnail: { alignItems: 'center', justifyContent: 'center', gap: Spacing.one },
  simulatedLabel: { ...Kicker, color: Palette.parisBlue },
  delete: { position: 'absolute', top: Spacing.twoHalf, right: Spacing.twoHalf },
  cardBody: { padding: Spacing.three, gap: Spacing.one },
  cardTitle: {
    ...Typography.body,
    color: Palette.ink,
    fontFamily: Fonts.sans,
    fontWeight: '700',
  },
  cardMeta: { ...Typography.caption, color: Palette.inkSoft, fontFamily: Fonts.sans },
  statusRow: {
    marginTop: Spacing.one,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  actions: {
    marginTop: Spacing.twoHalf,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  send: { flex: 1 },
  tool: { backgroundColor: Palette.blueMist, shadowOpacity: 0, elevation: 0 },
});
