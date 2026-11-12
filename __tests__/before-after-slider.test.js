import React from 'react';
import { act, create } from 'react-test-renderer';
import { Text } from 'react-native';

import { BeforeAfterSlider } from '@/components/before-after-slider';

jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => ({
  ...require('react-native-reanimated/mock'),
  useReducedMotion: () => false,
}));

jest.mock('@/hooks/use-image-aspect-ratio', () => ({
  useImageAspectRatio: () => ({ aspectRatio: 4 / 3 }),
}));

const before = { uri: 'https://example.test/1970.jpg' };
const after = { uri: 'https://example.test/2026.jpg' };
let renderer;

afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
});

const comparison = (props = {}) => <BeforeAfterSlider
  before={before} after={after} beforeLabel="1970" afterLabel="2026"
  showGestureHint {...props} />;
const photo = (uri) => renderer.root.findAll(node =>
  node.props.source?.uri === uri && typeof node.props.onLoad === 'function')[0];
const text = () => renderer.root.findAllByType(Text).map(node => node.props.children).join(' ');

it('attend les deux photos avant de proposer le geste de comparaison', async () => {
  await act(async () => { renderer = create(comparison()); });
  expect(text()).toContain('Chargement des deux photos');
  expect(text()).not.toContain('Glissez pour comparer');
  await act(async () => photo(before.uri).props.onLoad());
  expect(text()).not.toContain('Glissez pour comparer');
  await act(async () => photo(after.uri).props.onLoad());
  expect(text()).toContain('Glissez pour comparer');
  expect(text()).not.toContain('Chargement des deux photos');
});

it('permet de relancer les deux photos après un échec réseau', async () => {
  await act(async () => { renderer = create(comparison()); });
  await act(async () => photo(after.uri).props.onError());
  expect(text()).toContain('La comparaison n’a pas pu charger.');
  const retry = renderer.root.findAll(node =>
    node.props.accessibilityRole === 'button' && typeof node.props.onPress === 'function')[0];
  await act(async () => retry.props.onPress());
  expect(text()).toContain('Chargement des deux photos');
  await act(async () => {
    photo(before.uri).props.onLoad();
    photo(after.uri).props.onLoad();
  });
  expect(text()).toContain('Glissez pour comparer');
});

it('ignore les chargements de l’ancienne paire quand les sources changent', async () => {
  await act(async () => { renderer = create(comparison()); });
  const staleBefore = photo(before.uri).props.onLoad;
  const staleAfter = photo(after.uri).props.onLoad;
  const nextAfter = { uri: 'https://example.test/another-2026.jpg' };
  await act(async () => renderer.update(comparison({ after: nextAfter })));
  await act(async () => { staleBefore(); staleAfter(); });
  expect(text()).not.toContain('Glissez pour comparer');
  await act(async () => {
    photo(before.uri).props.onLoad();
    photo(nextAfter.uri).props.onLoad();
  });
  expect(text()).toContain('Glissez pour comparer');
});
