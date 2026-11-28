import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/primary-button';
import { Fonts, Palette, Radius, Spacing, Typography } from '@/constants/theme';
import { OFFICIAL_CONTRIBUTION_GUIDE } from '@/services/official-contribution-guide';

/**
 * Un seul écran avant le formulaire officiel : trois lignes, un bouton. C'est un calque dans
 * l'écran, pas une `Modal` : une Modal iOS ne s'ouvre pas de façon fiable par-dessus un écran
 * déjà présenté en plein écran (Expo Go la laissait invisible).
 */
export function OfficialContributionGuide({
  onComplete,
  visible,
}: {
  onComplete: () => void;
  visible: boolean;
}) {
  const insets = useSafeAreaInsets();
  if (!visible) return null;
  const guide = OFFICIAL_CONTRIBUTION_GUIDE;

  return (
    <View style={[StyleSheet.absoluteFill, styles.layer]}>
      <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)} style={StyleSheet.absoluteFill}>
        <Pressable accessibilityLabel="Fermer le guide" onPress={onComplete} style={styles.backdrop} />
      </Animated.View>
      <Animated.View
        // Glissement net et amorti, sans ressort : la feuille arrive et ne rebondit pas.
        entering={SlideInDown.duration(260).easing(Easing.out(Easing.cubic))}
        exiting={SlideOutDown.duration(180).easing(Easing.in(Easing.cubic))}
        style={[styles.sheetWrap, { paddingTop: insets.top + Spacing.three }]}>
        {/* Défile si le texte est agrandi : le bouton reste toujours atteignable. */}
        <ScrollView
          accessibilityViewIsModal
          bounces={false}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.three }]}
          showsVerticalScrollIndicator={false}
          style={styles.sheet}>
          <Text accessibilityRole="header" style={styles.title}>{guide.title}</Text>
          <View style={styles.steps}>
            {guide.steps.map((step, index) => (
              <View key={step.text} style={styles.step}>
                <View style={styles.number}>
                  <Text style={styles.numberText}>{index + 1}</Text>
                </View>
                <View style={styles.stepCopy}>
                  <Text style={styles.stepText}>{step.text}</Text>
                  {'note' in step ? <Text style={styles.stepNote}>{step.note}</Text> : null}
                </View>
              </View>
            ))}
          </View>
          <PrimaryButton label={guide.action} onPress={onComplete} style={styles.action} />
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { zIndex: 10, justifyContent: 'flex-end' },
  backdrop: { flex: 1, backgroundColor: 'rgba(7, 24, 35, 0.58)' },
  sheetWrap: { maxHeight: '100%', justifyContent: 'flex-end' },
  sheet: { flexGrow: 0, maxHeight: '100%', borderTopLeftRadius: Radius.large, borderTopRightRadius: Radius.large, backgroundColor: Palette.white },
  content: { paddingHorizontal: Spacing.three, paddingTop: Spacing.four },
  title: { ...Typography.display, color: Palette.ink, fontFamily: Fonts.display, fontWeight: '800' },
  steps: { marginTop: Spacing.three, gap: Spacing.three },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.twoHalf },
  number: { width: 32, height: 32, borderRadius: 16, backgroundColor: Palette.parisBlue, alignItems: 'center', justifyContent: 'center' },
  numberText: { ...Typography.body, color: Palette.white, fontFamily: Fonts.display, fontWeight: '800' },
  stepCopy: { flex: 1, gap: Spacing.one },
  stepText: { ...Typography.body, color: Palette.ink, fontFamily: Fonts.sans, fontWeight: '600' },
  stepNote: { ...Typography.caption, color: Palette.inkSoft, fontFamily: Fonts.sans },
  action: { marginTop: Spacing.four },
});
