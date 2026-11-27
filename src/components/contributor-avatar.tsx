import { StyleSheet, Text, View } from 'react-native';

import { Fonts, Palette } from '@/constants/theme';

const PARTICLES = ['de', 'du', 'des', 'le', 'la'];

/** Initiales lisibles, calculées sur le nom déjà réduit par `formatContributorName`. */
export function initialsFor(displayName: string) {
  return displayName
    .split(/[\s.-]+/)
    .filter(Boolean)
    .filter((part) => !PARTICLES.includes(part.toLocaleLowerCase('fr-FR')))
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase('fr-FR'))
    .join('');
}

type ContributorAvatarProps = {
  /** Nom affiché (« Martin de P. »). */
  name: string;
  size?: number;
  /** `strong` : bleu nuit plein (en-tête de profil) ; `soft` : pastille claire (listes). */
  tone?: 'strong' | 'soft';
};

/** La même pastille d'initiales partout : listes, recherche, profils. */
export function ContributorAvatar({ name, size = 44, tone = 'soft' }: ContributorAvatarProps) {
  const strong = tone === 'strong';
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.avatar,
        { width: size, height: size, borderRadius: size / 2 },
        strong ? styles.strong : styles.soft,
      ]}>
      <Text
        allowFontScaling={false}
        style={[
          styles.text,
          { fontSize: Math.round(size * 0.36), lineHeight: Math.round(size * 0.44) },
          strong ? styles.textStrong : styles.textSoft,
        ]}>
        {initialsFor(name)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: { alignItems: 'center', justifyContent: 'center' },
  strong: { backgroundColor: Palette.parisBlue },
  soft: { backgroundColor: Palette.blueMist },
  text: { fontFamily: Fonts.display, fontWeight: '900' },
  textStrong: { color: Palette.white },
  textSoft: { color: Palette.parisBlue },
});
