import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { Fonts, Palette, Radius, Typography } from '@/constants/theme';

type YearPillProps = {
  label: string | number;
  /** `archive` : orange, la photo de 1970 ; `today` : bleu nuit, la reprise. */
  tone: 'archive' | 'today';
  style?: StyleProp<ViewStyle>;
};

/** La pastille d'année, identique partout dans l'interface. */
export function YearPill({ label, tone, style }: YearPillProps) {
  return (
    <View style={[styles.pill, tone === 'archive' ? styles.archive : styles.today, style]}>
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.pill, alignSelf: 'flex-start' },
  archive: { backgroundColor: Palette.copper },
  today: { backgroundColor: Palette.parisBlue },
  text: { ...Typography.caption, color: Palette.white, fontFamily: Fonts.display, fontWeight: '800' },
});
