import { Image } from 'expo-image';
import { SymbolView } from '@/components/ui/symbol';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { YearPill } from '@/components/ui/year-pill';
import { Fonts, Palette, Radius, Spacing, Typography } from '@/constants/theme';
import { formatWalkDistance, type NextPhotoSuggestion } from '@/services/albums';
import type { SavedCapture } from '@/services/fieldbook-store';

type NextWalkPromptProps = {
  /** La seule photo prise aujourd'hui : la balade du jour attend sa deuxième photo. */
  todayCapture?: SavedCapture;
  suggestion?: NextPhotoSuggestion;
  onOpenSuggestion: () => void;
  /** Sans suggestion (aucune position connue), on choisit sur la carte. */
  onFindOnMap: () => void;
};

function suggestionLabel(suggestion: NextPhotoSuggestion | undefined) {
  if (!suggestion) return 'Choisir sur la carte';
  const distance = formatWalkDistance(suggestion.distanceMeters);
  return distance ? `Secteur ${suggestion.station.name} · à ${distance}` : `Secteur ${suggestion.station.name}, juste à côté`;
}

/**
 * Une balade commence à deux photos. Tant qu'il en manque une, on montre ce qui existe déjà et
 * une carte « + » qui propose la photo de 1970 la plus proche à refaire.
 */
export function NextWalkPrompt({ todayCapture, suggestion, onOpenSuggestion, onFindOnMap }: NextWalkPromptProps) {
  const label = suggestionLabel(suggestion);
  const addCard = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${todayCapture ? 'Ajouter une deuxième photo' : 'Refaire une photo'} : ${label}`}
      onPress={suggestion ? onOpenSuggestion : onFindOnMap}
      style={({ pressed }) => [styles.card, styles.addCard, !todayCapture && styles.addCardWide, pressed && styles.pressed]}>
      <View style={styles.plus}>
        <SymbolView name="plus" size={26} weight="bold" tintColor={Palette.white} />
      </View>
      <Text style={styles.addTitle}>{todayCapture ? '2ᵉ photo' : 'Refaire une photo'}</Text>
      <Text style={styles.addMeta}>{label}</Text>
      {suggestion ? (
        <Text style={styles.addHint}>
          {suggestion.remaining} {suggestion.remaining > 1 ? 'photos à refaire' : 'photo à refaire'}
        </Text>
      ) : null}
    </Pressable>
  );

  return (
    <View style={styles.wrap}>
      <Text accessibilityRole="header" style={styles.title}>
        {todayCapture ? 'Votre balade du jour commence' : 'Pas encore de balade'}
      </Text>
      <Text style={styles.copy}>
        {todayCapture
          ? 'Encore une photo aujourd’hui et votre balade se dessine sur une carte.'
          : 'Refaites deux photos le même jour : elles se relient en balade sur une carte.'}
      </Text>
      {todayCapture ? (
        <View style={styles.row}>
          <View style={[styles.card, styles.photoCard]}>
            {todayCapture.imageUri ? (
              <Image source={{ uri: todayCapture.imageUri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
            ) : null}
            <View style={styles.scrim} />
            <YearPill label="Aujourd’hui" tone="today" style={styles.pill} />
            <Text style={styles.photoLabel}>1ʳᵉ photo</Text>
          </View>
          {addCard}
        </View>
      ) : (
        addCard
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.two },
  title: { ...Typography.title, color: Palette.ink, fontFamily: Fonts.display, fontWeight: '800' },
  copy: { ...Typography.body, color: Palette.inkSoft, fontFamily: Fonts.sans },
  // La photo donne la hauteur de la rangée ; la carte « + » s'étire à la même hauteur.
  row: { marginTop: Spacing.one, flexDirection: 'row', alignItems: 'stretch', gap: Spacing.twoHalf },
  card: { flex: 1, borderRadius: Radius.large, overflow: 'hidden', backgroundColor: Palette.archive },
  photoCard: { aspectRatio: 3 / 4 },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(8, 17, 22, 0.18)' },
  pill: { position: 'absolute', left: Spacing.two, top: Spacing.two },
  photoLabel: { position: 'absolute', left: Spacing.twoHalf, bottom: Spacing.twoHalf, ...Typography.body, color: Palette.white, fontFamily: Fonts.display, fontWeight: '800' },
  addCard: { padding: Spacing.twoHalf, backgroundColor: Palette.white, borderWidth: 2, borderStyle: 'dashed', borderColor: Palette.go, alignItems: 'center', justifyContent: 'center', gap: Spacing.one },
  addCardWide: { flex: 0, minHeight: 180, marginTop: Spacing.one },
  plus: { width: 56, height: 56, borderRadius: 28, backgroundColor: Palette.go, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.one },
  addTitle: { ...Typography.body, color: Palette.ink, fontFamily: Fonts.display, fontWeight: '800', textAlign: 'center' },
  addMeta: { ...Typography.caption, color: Palette.ink, fontFamily: Fonts.sans, fontWeight: '600', textAlign: 'center' },
  addHint: { ...Typography.caption, color: Palette.inkSoft, fontFamily: Fonts.sans, textAlign: 'center' },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
});
