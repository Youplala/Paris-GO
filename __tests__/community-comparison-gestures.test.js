/* global jest, afterEach, it, expect */
import React from 'react';
import { act, create } from 'react-test-renderer';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { BeforeAfterSlider } from '@/components/before-after-slider';
import { CollectiveScreen } from '@/screens/collective';
import { ContributorScreen } from '@/screens/contributor';

jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => ({
  ...require('react-native-reanimated/mock'),
  useReducedMotion: () => false,
}));
jest.mock('@/hooks/use-image-aspect-ratio', () => ({
  useImageAspectRatio: () => ({ aspectRatio: 4 / 3 }),
}));
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn() }),
  useLocalSearchParams: () => ({ name: 'Élie B.' }),
}));
const mockPhoto = {
  id: 'comparison-test', name: 'Rue de Paris', year: 1970,
  referenceImage: { uri: 'https://example.test/before.jpg' },
  recaptureImage: { uri: 'https://example.test/after.jpg' },
};
jest.mock('@/providers/stations-provider', () => ({
  useStations: () => ({
    stations: [], snapshotVersion: '2026-11-24', publishedSubmissions: [mockPhoto],
    coverage: { published1970: 1, remaining1970: 9, percentage: 10 },
    stats: { contributorCount: 1, recapturesLast30Days: 1, topContributors: [] },
    findContributorSubmissions: () => [mockPhoto], refresh: jest.fn(), refreshing: false,
  }),
}));

let renderer;
afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
  jest.clearAllMocks();
});

it.each([
  ['le fil Communauté', CollectiveScreen],
  ['le profil contributeur', ContributorScreen],
])('sépare la comparaison du bouton de légende dans %s', async (_, Screen) => {
  // Gesture Handler 3 exige un GestureHandlerRootView au-dessus de chaque GestureDetector.
  await act(async () => {
    renderer = create(<GestureHandlerRootView><Screen /></GestureHandlerRootView>);
  });
  const slider = renderer.root.findByType(BeforeAfterSlider);
  // Un Pressable englobant peut recevoir le relâchement d’un glissé natif.
  for (let ancestor = slider.parent; ancestor; ancestor = ancestor.parent) {
    expect(ancestor.props.onPress).toBeUndefined();
  }
  expect(mockPush).not.toHaveBeenCalled();
  await act(async () => slider.props.onPressSide('before'));
  expect(mockPush).toHaveBeenLastCalledWith({
    pathname: '/station/[id]', params: { id: mockPhoto.id },
  });
  const caption = renderer.root.findAll(node =>
    node.props.accessibilityLabel === `Ouvrir la photo refaite ${mockPhoto.name}` &&
    typeof node.props.onPress === 'function')[0];
  expect(caption).toBeDefined();
  await act(async () => caption.props.onPress());
  expect(mockPush).toHaveBeenCalledTimes(2);
});
