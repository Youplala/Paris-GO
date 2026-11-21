import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { Fonts, HitSize, Palette, Radius, Shadow, Spacing, Typography } from '@/constants/theme';

export type IconButtonProps = {
  icon: SymbolViewProps['name'];
  accessibilityLabel: string;
  accessibilityHint?: string;
  onPress?: () => void;
  /**
   * `light` : sur le fond crème de l'app (fermer, partager, en-têtes).
   * `dark` : sur la caméra ou une photo sombre.
   * `glass` : flottant au-dessus d'une carte ou d'une image claire.
   */
  variant?: 'light' | 'dark' | 'glass';
  /** Texte facultatif à droite de l'icône (« Source ») : le bouton devient une pastille. */
  label?: string;
  selected?: boolean;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * Le bouton rond unique de l'app. Toutes les actions secondaires à icône (fermer, retour,
 * partager, localiser, réinitialiser…) passent par lui plutôt que par un Pressable maison.
 */
export function IconButton({
  icon,
  accessibilityLabel,
  accessibilityHint,
  onPress,
  variant = 'light',
  label,
  selected,
  disabled,
  loading,
  style,
}: IconButtonProps) {
  const tint = variant === 'dark' ? Palette.white : Palette.ink;
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: Boolean(isDisabled), selected: Boolean(selected), busy: Boolean(loading) }}
      disabled={isDisabled}
      hitSlop={label ? 0 : 6}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        label ? styles.withLabel : null,
        selected && styles.selected,
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles.pressed,
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={tint} />
      ) : (
        <SymbolView name={icon} size={18} tintColor={selected ? Palette.white : tint} />
      )}
      {label ? (
        <Text numberOfLines={1} style={[styles.label, { color: selected ? Palette.white : tint }]}>
          {label}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minWidth: HitSize,
    height: HitSize,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: Spacing.one,
  },
  withLabel: {
    paddingHorizontal: Spacing.twoHalf,
  },
  light: {
    backgroundColor: Palette.white,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Palette.line,
    ...Shadow.card,
  },
  dark: {
    backgroundColor: 'rgba(8, 17, 22, 0.62)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.22)',
  },
  glass: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(13, 42, 60, 0.10)',
    ...Shadow.card,
  },
  selected: {
    backgroundColor: Palette.parisBlue,
    borderColor: Palette.parisBlue,
  },
  disabled: {
    opacity: 0.45,
  },
  pressed: {
    transform: [{ scale: 0.92 }],
    opacity: 0.85,
  },
  label: {
    ...Typography.caption,
    fontFamily: Fonts.sans,
    fontWeight: '700',
    flexShrink: 1,
  },
});
