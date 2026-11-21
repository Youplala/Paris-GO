import * as Haptics from 'expo-haptics';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useCallback } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { ButtonHeight, Fonts, Palette, Radius, Shadow, Spacing, Typography } from '@/constants/theme';

export type PrimaryButtonProps = {
  label: string;
  onPress?: () => void;
  icon?: SymbolViewProps['name'];
  /**
   * `primary` : l'action de la mission (orange « GO »), une seule par écran.
   * `secondary` : action pleine mais subordonnée (bleu nuit).
   * `light` / `outline` : actions de repli.
   * `ghost` : action discrète, sans fond (« Plus tard », « Passer »).
   */
  variant?: 'primary' | 'secondary' | 'light' | 'outline' | 'ghost';
  /** `regular` : 52 pt, l'action de l'écran. `compact` : 44 pt, actions en ligne. */
  size?: 'regular' | 'compact';
  /** Côté de l'icône. Une flèche de progression se place à droite, un appareil photo à gauche. */
  iconPosition?: 'leading' | 'trailing';
  loading?: boolean;
  disabled?: boolean;
  /** Retour haptique léger au toucher. Actif par défaut pour `primary`. */
  haptic?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
};

export function PrimaryButton({
  label,
  onPress,
  icon,
  variant = 'primary',
  size = 'regular',
  iconPosition = 'trailing',
  loading,
  disabled,
  haptic,
  accessibilityLabel,
  accessibilityHint,
  style,
}: PrimaryButtonProps) {
  const isDisabled = Boolean(disabled || loading);
  const onFill = variant === 'primary' || variant === 'secondary';
  const tint = onFill ? Palette.white : variant === 'ghost' ? Palette.copper : Palette.parisBlue;
  const withHaptic = haptic ?? variant === 'primary';

  const handlePressIn = useCallback(() => {
    if (!withHaptic) return;
    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    } catch {
      // Pas de moteur haptique (simulateur, web) : sans importance.
    }
  }, [withHaptic]);

  const iconView = icon ? <SymbolView name={icon} size={18} tintColor={tint} /> : null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: isDisabled, busy: Boolean(loading) }}
      disabled={isDisabled}
      onPress={onPress}
      onPressIn={handlePressIn}
      style={({ pressed }) => [
        styles.base,
        { minHeight: ButtonHeight[size] },
        styles[variant],
        variant === 'primary' && !isDisabled && styles.primaryShadow,
        pressed && !isDisabled && pressedStyles[variant],
        pressed && !isDisabled && styles.pressed,
        disabled && !loading && styles.disabled,
        style,
      ]}>
      {/* Le contenu reste monté pendant le chargement : la taille du bouton ne bouge pas. */}
      <View style={[styles.content, loading && styles.hidden]}>
        {iconPosition === 'leading' ? iconView : null}
        <Text
          numberOfLines={1}
          style={[styles.label, { color: tint }]}>
          {label}
        </Text>
        {iconPosition === 'trailing' ? iconView : null}
      </View>
      {loading ? (
        <View pointerEvents="none" style={styles.spinner}>
          <ActivityIndicator color={tint} />
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.four,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  hidden: { opacity: 0 },
  spinner: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: { backgroundColor: Palette.go },
  primaryShadow: {
    shadowColor: Palette.go,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 12,
    elevation: 4,
  },
  secondary: { backgroundColor: Palette.parisBlue },
  light: {
    backgroundColor: Palette.white,
    ...Shadow.card,
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: Palette.parisBlue,
  },
  ghost: {
    backgroundColor: 'transparent',
    paddingHorizontal: Spacing.three,
  },
  label: {
    ...Typography.body,
    fontFamily: Fonts.sans,
    fontWeight: '700',
    letterSpacing: -0.2,
    flexShrink: 1,
  },
  pressed: {
    transform: [{ scale: 0.97 }],
  },
  disabled: {
    opacity: 0.45,
  },
});

const pressedStyles = StyleSheet.create({
  primary: { backgroundColor: Palette.goPressed },
  secondary: { backgroundColor: Palette.blueNightPressed },
  light: { backgroundColor: Palette.fog },
  outline: { backgroundColor: Palette.blueMist },
  ghost: { backgroundColor: Palette.goSoft },
});
