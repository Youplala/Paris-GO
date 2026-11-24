import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { SymbolView } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { Alert, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { Fonts, Palette, Radius, Spacing, Typography } from '@/constants/theme';
import { useUserLocation } from '@/hooks/use-user-location';
import {
  formatDistance,
  spotProximity,
  walkingDirectionsUrls,
  type Coordinate,
  type SquareBounds,
} from '@/services/field-spot';

type FieldSpotGuideProps = {
  target: Coordinate;
  bounds?: SquareBounds;
  approximate?: boolean;
};

/**
 * Aider à trouver le lieu : distance depuis l'utilisateur, signal « dans la zone » et itinéraire
 * à pied. La position n'est lue que si l'autorisation est déjà accordée ; sinon un bouton
 * explicite la demande.
 */
export function FieldSpotGuide({ target, bounds, approximate }: FieldSpotGuideProps) {
  const { coordinate, isPrecise, loading, locate } = useUserLocation();
  const [permissionKnown, setPermissionKnown] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void Location.getForegroundPermissionsAsync()
      .then((permission) => {
        if (cancelled) return;
        setPermissionGranted(permission.granted);
        setPermissionKnown(true);
        if (permission.granted) void locate();
      })
      .catch(() => {
        if (!cancelled) setPermissionKnown(true);
      });
    return () => {
      cancelled = true;
    };
  }, [locate]);

  const proximity = isPrecise ? spotProximity(coordinate, target, bounds) : undefined;

  const openDirections = async () => {
    void Haptics.selectionAsync();
    for (const url of walkingDirectionsUrls(target, Platform.OS)) {
      try {
        await Linking.openURL(url);
        return;
      } catch {
        // essaie l'URL suivante
      }
    }
    Alert.alert('Itinéraire indisponible', 'Aucune application de plans n’a pu s’ouvrir.');
  };

  return (
    <View style={styles.wrap}>
      {proximity?.inZone ? (
        <View accessibilityLiveRegion="polite" style={styles.inZone}>
          <SymbolView name="location.fill" size={15} tintColor={Palette.white} />
          <Text style={styles.inZoneText}>Vous êtes dans la zone</Text>
        </View>
      ) : proximity ? (
        <Text style={styles.distance}>
          À {formatDistance(proximity.distance)} de vous
          {approximate ? ' · zone approximative' : ''}
        </Text>
      ) : permissionKnown && !permissionGranted ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Me situer pour voir la distance"
          disabled={loading}
          onPress={() => {
            void Haptics.selectionAsync();
            void locate().then((position) => {
              if (position) setPermissionGranted(true);
            });
          }}
          style={({ pressed }) => [styles.locate, pressed && styles.pressed]}>
          <SymbolView name="location" size={15} tintColor={Palette.parisBlue} />
          <Text style={styles.locateText}>{loading ? 'Recherche…' : 'Me situer'}</Text>
        </Pressable>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Y aller à pied"
        accessibilityHint="Ouvre l’itinéraire à pied vers ce lieu"
        onPress={openDirections}
        style={({ pressed }) => [styles.goButton, pressed && styles.pressed]}>
        <SymbolView name="figure.walk" size={18} tintColor={Palette.white} />
        <Text style={styles.goText}>Y aller</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  distance: {
    ...Typography.caption,
    flex: 1,
    color: Palette.inkSoft,
    fontFamily: Fonts.sans,
  },
  inZone: {
    minHeight: 36,
    paddingHorizontal: Spacing.twoHalf,
    borderRadius: Radius.pill,
    backgroundColor: Palette.lichen,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  inZoneText: {
    ...Typography.caption,
    color: Palette.white,
    fontFamily: Fonts.sans,
    fontWeight: '700',
  },
  locate: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  locateText: {
    ...Typography.caption,
    color: Palette.parisBlue,
    fontFamily: Fonts.sans,
    fontWeight: '700',
  },
  goButton: {
    minHeight: 44,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.pill,
    backgroundColor: Palette.parisBlue,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  goText: {
    ...Typography.body,
    color: Palette.white,
    fontFamily: Fonts.sans,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.97 }],
  },
});
