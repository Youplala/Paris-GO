import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Fonts, HitSize, Palette, Radius, Typography } from '@/constants/theme';

type Option<T extends string> = { value: T; label: string; accessibilityLabel?: string };

type SegmentedControlProps<T extends string> = {
  options: readonly Option<T>[];
  value: T;
  onChange: (value: T) => void;
};

/** Le sélecteur unique de l'app : segments de 44 pt, actif en bleu nuit. */
export function SegmentedControl<T extends string>({ options, value, onChange }: SegmentedControlProps<T>) {
  return (
    <View accessibilityRole="tablist" style={styles.track}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityLabel={option.accessibilityLabel ?? option.label}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => {
              if (active) return;
              void Haptics.selectionAsync();
              onChange(option.value);
            }}
            style={[styles.item, active && styles.itemActive]}>
            <Text style={[styles.text, active && styles.textActive]} numberOfLines={2}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', padding: 3, gap: 3, borderRadius: Radius.pill, backgroundColor: Palette.blueMist },
  item: { flex: 1, minHeight: HitSize, paddingHorizontal: 12, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
  itemActive: { backgroundColor: Palette.ink },
  text: { ...Typography.caption, color: Palette.inkSoft, fontFamily: Fonts.sans, fontWeight: '700', textAlign: 'center' },
  textActive: { color: Palette.white },
});
