import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IconButton } from '@/components/ui/icon-button';
import { Fonts, Kicker, Palette, Spacing, Typography } from '@/constants/theme';

type ScreenHeaderProps = {
  title: string;
  /** Petite ligne au-dessus du titre (« ARCHIVES DE 1970 »). */
  kicker?: string;
  /**
   * `stack` : écran empilé, retour à gauche puis le titre.
   * `sheet` : feuille modale, titre à gauche et fermeture à droite.
   */
  variant?: 'stack' | 'sheet';
  onBack?: () => void;
  onClose?: () => void;
  /** Respecter la zone sûre du haut (faux dans une feuille, qui commence sous l'encoche). */
  safeTop?: boolean;
};

/** L'en-tête commun : même marge, mêmes boutons de 44 pt, même hiérarchie partout. */
export function ScreenHeader({ title, kicker, variant = 'stack', onBack, onClose, safeTop = true }: ScreenHeaderProps) {
  return (
    <SafeAreaView edges={safeTop ? ['top'] : []} style={styles.header}>
      {variant === 'stack' && onBack ? (
        <IconButton icon="chevron.left" accessibilityLabel="Retour" onPress={onBack} />
      ) : null}
      <View style={styles.copy}>
        {kicker ? <Text style={styles.kicker}>{kicker}</Text> : null}
        <Text accessibilityRole="header" style={styles.title} numberOfLines={2}>{title}</Text>
      </View>
      {variant === 'sheet' && onClose ? (
        <IconButton icon="xmark" accessibilityLabel="Fermer" onPress={onClose} />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.twoHalf,
  },
  copy: { flex: 1 },
  kicker: { ...Kicker, color: Palette.go },
  title: { ...Typography.display, color: Palette.ink, fontFamily: Fonts.display, fontWeight: '800' },
});
