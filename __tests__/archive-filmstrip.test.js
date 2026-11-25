import React from 'react';
import { act, create } from 'react-test-renderer';
import { Text } from 'react-native';
import { ArchiveFilmstrip } from '@/components/archive-filmstrip';

let renderer;
afterEach(async () => { if (renderer) await act(async () => renderer.unmount()); });

const images = [1, 2, 3, 4].map((n) => ({ uri: `https://example.test/${n}.jpg` }));
const frameButtons = () => renderer.root.findAll(node =>
  node.props.accessibilityRole === 'button' && typeof node.props.onPress === 'function');
const texts = () => renderer.root.findAllByType(Text).map(node => [].concat(node.props.children).join(''));

it('annonce le statut par photo et sélectionne la bonne archive, même déjà refaite', async () => {
  const onSelect = jest.fn();
  await act(async () => { renderer = create(<ArchiveFilmstrip
    images={images.slice(0, 2)}
    selectedIndex={0} recaptureCounts={[0, 2]} onSelect={onSelect} />); });
  const buttons = frameButtons();
  const refaite = buttons.find(node => node.props.accessibilityLabel.includes('déjà refaite'));
  expect(refaite).toBeDefined();
  expect(buttons.some(node => node.props.accessibilityLabel.includes('aucune reprise identifiée'))).toBe(true);
  await act(async () => refaite.props.onPress());
  expect(onSelect).toHaveBeenCalledWith(1);
});

it('ne marque visuellement que les photos refaites', async () => {
  await act(async () => { renderer = create(<ArchiveFilmstrip
    images={images} selectedIndex={0} recaptureCounts={[0, 1, 0, 0]} onSelect={jest.fn()} />); });
  expect(texts()).not.toContain('À retrouver');
  expect(texts()).not.toContain('Refaite');
  expect(texts()).toEqual(['01', '02', '03', '04']);
});

it('n’affiche que les vignettes demandées en gardant leur numéro de planche', async () => {
  const onSelect = jest.fn();
  await act(async () => { renderer = create(<ArchiveFilmstrip
    images={images} selectedIndex={3} recaptureCounts={[0, 1, 0, 3]}
    visibleIndices={[1, 3]} onSelect={onSelect} />); });
  expect(texts()).toEqual(['02', '04']);
  const buttons = frameButtons();
  expect(buttons).toHaveLength(2);
  expect(buttons[1].props.accessibilityState.selected).toBe(true);
  await act(async () => buttons[0].props.onPress());
  expect(onSelect).toHaveBeenCalledWith(1);
});
