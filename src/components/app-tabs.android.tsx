import { Tabs, type BottomTabBarProps } from 'expo-router/js-tabs';
import { useEffect, useState } from 'react';
import { Keyboard, Pressable, StyleSheet, Text, View } from 'react-native';
import type { SFSymbol } from 'sf-symbols-typescript';

import { SymbolView } from '@/components/ui/symbol';
import { FloatingTabBar as Bar, Fonts, Palette, Radius, Spacing, Typography } from '@/constants/theme';

/** Mêmes onglets, même ordre que la barre native d'iOS (`app-tabs.tsx`). */
const TABS: readonly { name: string; label: string; icon: SFSymbol }[] = [
  { name: 'index', label: 'Autour', icon: 'location' },
  { name: 'map', label: 'Carte', icon: 'map' },
  { name: 'collective', label: 'Communauté', icon: 'person.2' },
  { name: 'about', label: 'À propos', icon: 'info.circle' },
];

/**
 * Sous Android, la barre Material par défaut jurait avec l'app : un bandeau blanc pleine largeur,
 * haut, au contraste fade. On lui préfère une pilule flottante dans la palette de Paris GO, qui
 * reprend la place et le rôle de la barre Liquid Glass d'iOS.
 */
export default function AppTabs() {
  return (
    <Tabs
      screenOptions={{ headerShown: false, animation: 'fade', sceneStyle: { backgroundColor: Palette.fog } }}
      tabBar={(props) => <FloatingTabBarView {...props} />}>
      {TABS.map((tab) => (
        <Tabs.Screen key={tab.name} name={tab.name} options={{ title: tab.label }} />
      ))}
    </Tabs>
  );
}

function useKeyboardVisible() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setVisible(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return visible;
}

function FloatingTabBarView({ state, emitter, navigateToTab, insets }: BottomTabBarProps) {
  // Clavier ouvert (recherche sur la carte) : la pilule remonterait par-dessus les suggestions.
  if (useKeyboardVisible()) return null;

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrap, { bottom: Math.max(insets.bottom, Spacing.two) + Bar.gap }]}>
      <View role="tablist" style={styles.bar}>
        {state.routes.map((route, index) => {
          const tab = TABS.find((candidate) => candidate.name === route.name);
          if (!tab) return null;
          const focused = index === state.index;
          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityLabel={tab.label}
              accessibilityState={{ selected: focused }}
              onPress={() => {
                const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!focused && !event.defaultPrevented) navigateToTab(route.key);
              }}
              onLongPress={() => emitter.emit({ type: 'tabLongPress', target: route.key })}
              style={({ pressed }) => [styles.item, pressed && styles.pressed]}>
              <View style={styles.indicator}>
                {/* Pastille toujours peinte, seule son opacité change : quand Android ajoutait le fond
                    après coup, au changement d'onglet, il perdait l'arrondi et dessinait un carré. */}
                <View style={[styles.indicatorFill, { opacity: focused ? 1 : 0 }]} />
                <SymbolView
                  name={tab.icon}
                  size={22}
                  weight={focused ? 'semibold' : undefined}
                  tintColor={focused ? Palette.go : Palette.inkSoft}
                />
              </View>
              <Text numberOfLines={1} style={[styles.label, focused && styles.labelActive]}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: Spacing.three, right: Spacing.three },
  bar: {
    height: Bar.height,
    paddingHorizontal: Spacing.one,
    borderRadius: Radius.pill,
    backgroundColor: Palette.white,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Palette.line,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: Palette.blueDeep,
    elevation: 10,
  },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 },
  pressed: { opacity: 0.7 },
  indicator: { width: 52, height: 30, alignItems: 'center', justifyContent: 'center' },
  indicatorFill: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, borderRadius: 15, backgroundColor: Palette.goSoft },
  label: { ...Typography.caption, fontSize: 12, lineHeight: 16, color: Palette.inkSoft, fontFamily: Fonts.sans },
  labelActive: { color: Palette.go, fontWeight: '700' },
});
