import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/primary-button';
import { Fonts, Palette, Radius, Spacing, Typography } from '@/constants/theme';
import { OFFICIAL_CONTRIBUTION_GUIDE } from '@/services/official-contribution-guide';

/** Un seul écran avant le formulaire officiel : trois lignes, un bouton. */
export function OfficialContributionGuide({
  onComplete,
  visible,
}: {
  onComplete: () => void;
  visible: boolean;
}) {
  // Une Modal est une fenêtre à part : le SafeAreaView qu'on y place mesure des marges nulles.
  // Les marges du provider racine, elles, restent justes ici.
  const insets = useSafeAreaInsets();
  const guide = OFFICIAL_CONTRIBUTION_GUIDE;

  return (
    <Modal animationType="slide" onRequestClose={onComplete} statusBarTranslucent transparent visible={visible}>
      <View style={[styles.backdrop, { paddingTop: insets.top + Spacing.three }]}>
        {/* Défile si le texte est agrandi : le bouton reste toujours atteignable. */}
        <ScrollView
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
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(7, 24, 35, 0.58)', justifyContent: 'flex-end' },
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
