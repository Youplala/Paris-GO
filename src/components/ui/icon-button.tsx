import { SymbolView } from '@/components/ui/symbol';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import type { SFSymbol } from 'sf-symbols-typescript';

import { GlassBackdrop } from '@/components/glass-icon-button';
import { HitSize, Palette, Shadow } from '@/constants/theme';

type IconButtonProps = {
  icon: SFSymbol;
  accessibilityLabel: string;
  onPress: () => void;
  /** `surface` : disque blanc sur le fond de l'app ; `media` : verre sombre posé sur une photo ou une carte. */
  variant?: 'surface' | 'media';
  style?: StyleProp<ViewStyle>;
};

/** Le seul bouton rond à icône de l'app : 44 pt, icône de 18 pt. */
export function IconButton({ icon, accessibilityLabel, onPress, variant = 'surface', style }: IconButtonProps) {
  const media = variant === 'media';
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.base, !media && styles.surface, pressed && styles.pressed, style]}>
      {media ? <GlassBackdrop radius={HitSize / 2} /> : null}
      <SymbolView name={icon} size={18} weight="semibold" tintColor={media ? Palette.white : Palette.ink} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { width: HitSize, height: HitSize, borderRadius: HitSize / 2, alignItems: 'center', justifyContent: 'center' },
  surface: { backgroundColor: Palette.white, ...Shadow.card },
  pressed: { opacity: 0.8, transform: [{ scale: 0.95 }] },
});
