/* global jest, afterEach, it, expect */
import React from 'react';
import { act, create } from 'react-test-renderer';
import { TextInput } from 'react-native';
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
  useLocalSearchParams: () => ({ name: 'Martin DE PRESSENSÉ' }),
}));
const photo = (id, name) => ({
  id, name, year: 1970, arrondissement: '75013', recaptureDate: '2026-08-01',
  referenceImage: { uri: `https://example.test/${id}-1970.jpg` },
  recaptureImage: { uri: `https://example.test/${id}-2026.jpg` },
});
const mockPhotos = {
  'Martin DE PRESSENSÉ': [photo('a', 'Rue de l’Espérance'), photo('b', 'Place d’Italie')],
  'Pascal MARTIN': [photo('c', 'Rue Mouffetard')],
};
jest.mock('@/providers/stations-provider', () => ({
  useStations: () => ({
    stations: [], snapshotVersion: '2026-11-24', publishedSubmissions: [],
    coverage: { published1970: 3106, remaining1970: 9, percentage: 12 },
    stats: {
      contributorCount: 2, recapturesLast30Days: 1,
      topContributors: [{ name: 'Martin DE PRESSENSÉ', count: 2 }, { name: 'Pascal MARTIN', count: 1 }],
    },
    findContributorSubmissions: (name) => mockPhotos[name] ?? [],
    refresh: jest.fn(), refreshing: false,
  }),
}));

let renderer;
afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
  jest.clearAllMocks();
});

const texts = () => renderer.root.findAll((node) => typeof node.props.children === 'string' && node.type === 'Text')
  .map((node) => node.props.children);

it('retrouve une personne par son prénom depuis la Communauté, avec ses dernières photos', async () => {
  await act(async () => {
    renderer = create(<GestureHandlerRootView><CollectiveScreen /></GestureHandlerRootView>);
  });
  const input = renderer.root.findByType(TextInput);
  expect(input.props.placeholder).toBe('Chercher un prénom');
  await act(async () => input.props.onChangeText('pasc'));
  expect(texts()).toEqual(expect.arrayContaining(['1 personne trouvée', 'Pascal M.']));
  const thumb = renderer.root.findAll((node) =>
    node.props.accessibilityLabel === 'Ouvrir la photo Rue Mouffetard' && typeof node.props.onPress === 'function')[0];
  await act(async () => thumb.props.onPress());
  expect(mockPush).toHaveBeenLastCalledWith({ pathname: '/station/[id]', params: { id: 'c' } });
  const row = renderer.root.findAll((node) =>
    node.props.accessibilityLabel === 'Voir les photos de Pascal M., 1 photo refaite' && typeof node.props.onPress === 'function')[0];
  await act(async () => row.props.onPress());
  expect(mockPush).toHaveBeenLastCalledWith({ pathname: '/contributor/[name]', params: { name: 'Pascal MARTIN' } });
});

it('dit clairement quand personne ne porte ce prénom', async () => {
  await act(async () => {
    renderer = create(<GestureHandlerRootView><CollectiveScreen /></GestureHandlerRootView>);
  });
  await act(async () => renderer.root.findByType(TextInput).props.onChangeText('Zoé'));
  expect(texts()).toContain('Personne ne porte ce prénom dans le relevé');
});

it('montre les photos d’une personne en grand format, puis en grille au choix', async () => {
  await act(async () => {
    renderer = create(<GestureHandlerRootView><ContributorScreen /></GestureHandlerRootView>);
  });
  expect(texts()).toEqual(expect.arrayContaining(['Martin de P.', 'Photographe d’aujourd’hui', 'Rue de l’Espérance', 'Place d’Italie']));
  expect(renderer.root.findAllByType(BeforeAfterSlider)).toHaveLength(2);
  const gridTab = renderer.root.findAll((node) =>
    node.props.accessibilityLabel === 'Grille' && typeof node.props.onPress === 'function')[0];
  await act(async () => gridTab.props.onPress());
  expect(renderer.root.findAllByType(BeforeAfterSlider)).toHaveLength(0);
  const tile = renderer.root.findAll((node) =>
    node.props.accessibilityLabel === 'Ouvrir la photo refaite Place d’Italie' && typeof node.props.onPress === 'function')[0];
  await act(async () => tile.props.onPress());
  expect(mockPush).toHaveBeenLastCalledWith({ pathname: '/station/[id]', params: { id: 'b' } });
});
