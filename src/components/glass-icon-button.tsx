import { GlassView } from 'expo-glass-effect';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import type { SFSymbol } from 'sf-symbols-typescript';

import { supportsLiquidGlass } from '@/components/glass-surface';
import { Palette } from '@/constants/theme';

/**
 * Verre sombre posé sur la carte : `colorScheme` forcé en sombre pour que les boutons gardent la
 * même teinte au-dessus d'un toit clair comme d'une avenue sombre.
 */
function DarkGlass({ radius, prominent }: { radius: number; prominent?: boolean }) {
  if (!supportsLiquidGlass()) {
    return (
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, styles.fallback, { borderRadius: radius }, prominent && styles.prominentFallback]}
      />
    );
  }
  return (
    <GlassView
      pointerEvents="none"
      colorScheme="dark"
      glassEffectStyle="regular"
      isInteractive
      tintColor={prominent ? 'rgba(204, 72, 28, 0.85)' : 'rgba(13, 42, 60, 0.42)'}
      style={[StyleSheet.absoluteFill, { borderRadius: radius }]}
    />
  );
}

type IconAction = {
  systemImage: SFSymbol;
  accessibilityLabel: string;
  onPress: () => void;
  /** Action en cours (lecture) : verre teinté orange GO. */
  prominent?: boolean;
};

type GlassIconButtonProps = IconAction & { size?: number; style?: StyleProp<ViewStyle> };

/** Bouton rond flottant sur la carte, en Liquid Glass sombre. */
export function GlassIconButton({ systemImage, accessibilityLabel, onPress, prominent, size = 50, style }: GlassIconButtonProps) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      hitSlop={6}
      onPress={onPress}
      style={({ pressed }) => [{ width: size, height: size }, styles.center, pressed && styles.pressed, style]}>
      <DarkGlass radius={size / 2} prominent={prominent} />
      <SymbolView name={systemImage} size={size * 0.4} weight="semibold" tintColor={Palette.white} />
    </Pressable>
  );
}

/** Plusieurs actions dans une même capsule verticale de verre, comme les outils d'une carte. */
export function GlassButtonColumn({ actions, size = 50 }: { actions: readonly IconAction[]; size?: number }) {
  return (
    <View style={[styles.column, { width: size, borderRadius: size / 2 }]}>
      <DarkGlass radius={size / 2} />
      {actions.map((action) => (
        <Pressable
          key={action.accessibilityLabel}
          accessibilityLabel={action.accessibilityLabel}
          accessibilityRole="button"
          onPress={action.onPress}
          style={({ pressed }) => [{ width: size, height: size + 4 }, styles.center, pressed && styles.pressed]}>
          {action.prominent ? (
            <View style={[styles.activeDot, { width: size - 10, height: size - 10, borderRadius: (size - 10) / 2 }]} />
          ) : null}
          <SymbolView name={action.systemImage} size={size * 0.4} weight="semibold" tintColor={Palette.white} />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  fallback: {
    backgroundColor: 'rgba(13, 42, 60, 0.76)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.28)',
  },
  prominentFallback: { backgroundColor: Palette.go },
  column: { paddingVertical: 4, overflow: 'hidden' },
  activeDot: { position: 'absolute', backgroundColor: Palette.go },
  pressed: { opacity: 0.8, transform: [{ scale: 0.94 }] },
});
