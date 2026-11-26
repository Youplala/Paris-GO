import React from 'react';
import { act, create } from 'react-test-renderer';
import { Text } from 'react-native';

jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => ({ ...require('react-native-reanimated/mock'), useReducedMotion: () => false }));

const { CaptureCelebration } = require('@/components/capture-celebration');

let renderer;
afterEach(async () => { if (renderer) await act(async () => renderer.unmount()); });
const texts = () => renderer.root.findAllByType(Text).map((node) => [].concat(node.props.children).join(''));

it('part de 1970, annonce l’écart et le lieu, et se laisse passer d’un toucher', async () => {
  const onDone = jest.fn();
  await act(async () => {
    renderer = create(
      <CaptureCelebration
        before={{ uri: 'https://example.test/1970.jpg' }}
        after={{ uri: 'file:///2026.jpg' }}
        fromYear={1970}
        toYear={2026}
        place="Secteur 995 · photo 7"
        onDone={onDone}
      />,
    );
  });
  expect(texts()).toEqual(expect.arrayContaining([
    '1970', '56 ANS PLUS TARD', 'Bravo, c’est refait !', 'Secteur 995 · photo 7', 'Toucher pour continuer',
  ]));
  const skip = renderer.root.findAll((node) => node.props.accessibilityLabel === 'Passer l’animation' && typeof node.props.onPress === 'function')[0];
  await act(async () => skip.props.onPress());
  expect(onDone).toHaveBeenCalled();
});
