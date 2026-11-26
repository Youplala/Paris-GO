import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { Illustrations } from '@/constants/illustrations';
import { Fonts, Kicker, Palette, Radius, Shadow, Spacing, Typography } from '@/constants/theme';
import type { Badge, BadgeId } from '@/services/badges';

const ART: Record<BadgeId, number> = {
  first: Illustrations.badgeFirst,
  ten: Illustrations.badgeTen,
  sector: Illustrations.badgeSector,
};

/** Les badges du carnet : en couleur une fois gagnés, grisés avec leur progression avant. */
export function BadgeShelf({ badges }: { badges: readonly Badge[] }) {
  const won = badges.filter((badge) => badge.unlocked).length;
  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.kicker}>MES BADGES</Text>
        <Text style={styles.count}>{won}/{badges.length}</Text>
      </View>
      <View style={styles.row}>
        {badges.map((badge) => (
          <View
            key={badge.id}
            accessible
            accessibilityLabel={`${badge.title}, ${badge.unlocked ? 'gagné' : `à gagner${badge.progress ? `, ${badge.progress}` : ''}. ${badge.hint}`}`}
            style={styles.badge}>
            <Image source={ART[badge.id]} style={[styles.art, !badge.unlocked && styles.locked]} contentFit="contain" />
            <Text style={[styles.title, !badge.unlocked && styles.titleLocked]} numberOfLines={2}>{badge.title}</Text>
            {badge.progress ? <Text style={styles.progress}>{badge.progress}</Text> : null}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: Spacing.three, padding: Spacing.three, borderRadius: Radius.large, backgroundColor: Palette.white, ...Shadow.card },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  kicker: { ...Kicker, color: Palette.go },
  count: { ...Typography.caption, color: Palette.inkSoft, fontFamily: Fonts.display, fontWeight: '800' },
  row: { marginTop: Spacing.twoHalf, flexDirection: 'row', gap: Spacing.two },
  badge: { flex: 1, alignItems: 'center' },
  art: { width: 72, height: 72 },
  locked: { opacity: 0.28 },
  title: { ...Typography.caption, marginTop: Spacing.one, color: Palette.ink, fontFamily: Fonts.sans, fontWeight: '700', textAlign: 'center' },
  titleLocked: { color: Palette.inkSoft },
  progress: { ...Typography.caption, color: Palette.go, fontFamily: Fonts.display, fontWeight: '800' },
});
